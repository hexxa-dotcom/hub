-- ESCRITURAÇÃO CONTÁBIL — razão de partidas dobradas.
--
-- Até aqui o Hub tinha movimento de caixa (financial_entry) e um "fechamento"
-- que era a soma desse movimento. Isto cria a camada que faltava: partidas
-- que fecham em zero, conferíveis, entregáveis à contabilidade — e que servem
-- de invariante para validar o que uma IA lançar.

-- Tipos criados condicionalmente: este repositório aplica migrations por
-- scripts avulsos, sem journal confiável, então tudo aqui precisa aguentar
-- ser executado duas vezes.
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITA', 'DESPESA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_nature AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_direction AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_status AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_source AS ENUM (
    'FINANCIAL_ENTRY', 'NFSE', 'TAX_GUIDE', 'PAYSLIP', 'PROFIT_DISTRIBUTION',
    'BANK_TRANSACTION', 'CLOSING', 'OPENING', 'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE journal_event AS ENUM ('ACCRUAL', 'SETTLEMENT', 'REVERSAL', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Plano de contas ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_of_account (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  type         account_type NOT NULL,
  nature       account_nature NOT NULL,
  parent_code  TEXT,
  analytical   BOOLEAN NOT NULL DEFAULT TRUE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chart_of_account_company_code
  ON chart_of_account (company_id, code);
CREATE INDEX IF NOT EXISTS idx_chart_of_account_company
  ON chart_of_account (company_id);

-- ── Partida (cabeçalho) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  entry_date          DATE NOT NULL,
  reference_month     DATE NOT NULL,
  memo                TEXT NOT NULL,
  source              journal_source NOT NULL,
  source_id           UUID,
  event               journal_event NOT NULL,
  status              journal_status NOT NULL DEFAULT 'DRAFT',
  reversed_by         UUID REFERENCES journal_entry(id),
  created_by_user_id  UUID REFERENCES app_user(id) ON DELETE SET NULL,
  agent_run_id        UUID,
  posted_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_company ON journal_entry (company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_month   ON journal_entry (company_id, reference_month);

-- Idempotência: um documento produz no máximo uma partida viva por fato
-- contábil. É o que torna seguro um agente reexecutar o lançamento depois de
-- uma falha parcial — a segunda tentativa colide em vez de duplicar a receita.
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entry_source_event
  ON journal_entry (company_id, source, source_id, event)
  WHERE source_id IS NOT NULL AND status <> 'REVERSED';

-- ── Linhas do razão ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_line (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  journal_entry_id  UUID NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES chart_of_account(id),
  direction         ledger_direction NOT NULL,
  amount            NUMERIC(14,2) NOT NULL,
  sequence          INTEGER NOT NULL DEFAULT 0,
  line_memo         TEXT,
  partner_id        UUID REFERENCES business_partner(id) ON DELETE SET NULL,
  cost_center_id    UUID REFERENCES cost_center(id) ON DELETE SET NULL,
  -- Valor é sempre positivo: o lado é o enum `direction`. Sem isso abriria-se
  -- espaço para "débito de -100", que ninguém sabe ler e que faz a partida
  -- fechar em zero estando errada.
  CONSTRAINT ck_ledger_line_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_line_company ON ledger_line (company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_line_journal ON ledger_line (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_line_account ON ledger_line (account_id);

-- ── O invariante ────────────────────────────────────────────────────────────
--
-- Débito = crédito em toda partida POSTED, verificado pelo banco e não pela
-- aplicação. Está aqui, e não no TypeScript, justamente porque é a âncora que
-- torna verificável o trabalho de um agente: nenhum caminho de código — nem
-- um script, nem uma IA, nem uma correção manual no psql — consegue gravar
-- uma partida que não fecha.
--
-- DEFERRABLE INITIALLY DEFERRED: dentro de uma transação a partida passa por
-- estados desbalanceados enquanto as linhas são inseridas uma a uma; o que
-- não pode é a transação TERMINAR desbalanceada.

CREATE OR REPLACE FUNCTION assert_journal_entry_balanced() RETURNS TRIGGER AS $$
DECLARE
  target_id   UUID;
  je_status   journal_status;
  total_debit NUMERIC(14,2);
  total_credit NUMERIC(14,2);
  line_count  INTEGER;
BEGIN
  target_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT status INTO je_status FROM journal_entry WHERE id = target_id;
  -- Partida apagada na mesma transação (cascade): nada a conferir.
  IF je_status IS NULL THEN RETURN NULL; END IF;
  -- DRAFT pode estar desbalanceada: ainda está sendo montada.
  IF je_status <> 'POSTED' THEN RETURN NULL; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
    COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0),
    COUNT(*)
  INTO total_debit, total_credit, line_count
  FROM ledger_line WHERE journal_entry_id = target_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'Partida % tem % linha(s): uma partida dobrada exige ao menos um débito e um crédito.',
      target_id, line_count;
  END IF;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Partida % não fecha: débito % <> crédito %.',
      target_id, total_debit, total_credit;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_line_balanced ON ledger_line;
CREATE CONSTRAINT TRIGGER trg_ledger_line_balanced
  AFTER INSERT OR UPDATE OR DELETE ON ledger_line
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_balanced();

-- Mesma checagem pelo outro lado: publicar uma partida (DRAFT -> POSTED) não
-- toca em ledger_line, então o trigger acima não dispararia.
CREATE OR REPLACE FUNCTION assert_journal_entry_balanced_on_post() RETURNS TRIGGER AS $$
DECLARE
  total_debit  NUMERIC(14,2);
  total_credit NUMERIC(14,2);
  line_count   INTEGER;
BEGIN
  IF NEW.status <> 'POSTED' THEN RETURN NULL; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
    COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0),
    COUNT(*)
  INTO total_debit, total_credit, line_count
  FROM ledger_line WHERE journal_entry_id = NEW.id;

  IF line_count < 2 THEN
    RAISE EXCEPTION 'Partida % não pode ser publicada com % linha(s).', NEW.id, line_count;
  END IF;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Partida % não pode ser publicada: débito % <> crédito %.',
      NEW.id, total_debit, total_credit;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_balanced_on_post ON journal_entry;
CREATE CONSTRAINT TRIGGER trg_journal_entry_balanced_on_post
  AFTER INSERT OR UPDATE ON journal_entry
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_entry_balanced_on_post();

-- Partida publicada é imutável. Correção se faz por estorno, não por UPDATE —
-- é o que mantém o histórico auditável quando quem lançou foi um agente.
CREATE OR REPLACE FUNCTION assert_posted_entry_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'POSTED' AND NEW.status = 'POSTED' THEN
    IF (NEW.entry_date, NEW.reference_month, NEW.memo, NEW.source, NEW.source_id, NEW.event)
       IS DISTINCT FROM
       (OLD.entry_date, OLD.reference_month, OLD.memo, OLD.source, OLD.source_id, OLD.event) THEN
      RAISE EXCEPTION 'Partida % já está publicada: corrija por estorno, não por alteração.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_immutable ON journal_entry;
CREATE TRIGGER trg_journal_entry_immutable
  BEFORE UPDATE ON journal_entry
  FOR EACH ROW EXECUTE FUNCTION assert_posted_entry_immutable();

-- Linha de partida publicada também não se altera.
CREATE OR REPLACE FUNCTION assert_posted_lines_immutable() RETURNS TRIGGER AS $$
DECLARE
  je_status journal_status;
BEGIN
  SELECT status INTO je_status
  FROM journal_entry
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  IF je_status = 'POSTED' THEN
    RAISE EXCEPTION 'Linhas de uma partida publicada são imutáveis: use estorno.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_line_immutable ON ledger_line;
CREATE TRIGGER trg_ledger_line_immutable
  BEFORE UPDATE OR DELETE ON ledger_line
  FOR EACH ROW EXECUTE FUNCTION assert_posted_lines_immutable();

-- Só conta analítica recebe lançamento; sintética existe para somar as filhas.
CREATE OR REPLACE FUNCTION assert_account_is_analytical() RETURNS TRIGGER AS $$
DECLARE
  is_analytical BOOLEAN;
  is_active     BOOLEAN;
  acct_code     TEXT;
BEGIN
  SELECT analytical, active, code INTO is_analytical, is_active, acct_code
  FROM chart_of_account WHERE id = NEW.account_id;

  IF NOT is_analytical THEN
    RAISE EXCEPTION 'Conta % é sintética e não recebe lançamento.', acct_code;
  END IF;
  IF NOT is_active THEN
    RAISE EXCEPTION 'Conta % está inativa.', acct_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_line_analytical_account ON ledger_line;
CREATE TRIGGER trg_ledger_line_analytical_account
  BEFORE INSERT ON ledger_line
  FOR EACH ROW EXECUTE FUNCTION assert_account_is_analytical();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE chart_of_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_line      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON chart_of_account;
CREATE POLICY tenant_isolation ON chart_of_account
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DROP POLICY IF EXISTS tenant_isolation ON journal_entry;
CREATE POLICY tenant_isolation ON journal_entry
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DROP POLICY IF EXISTS tenant_isolation ON ledger_line;
CREATE POLICY tenant_isolation ON ledger_line
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
