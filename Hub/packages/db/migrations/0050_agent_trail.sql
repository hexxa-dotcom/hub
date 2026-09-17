-- TRILHA DE AGENTE — quem fez, com base em quê, e quem deixou.
--
-- O razão (0049) garante que o resultado fecha. Isto garante que ele é
-- explicável. São coisas diferentes, e a segunda é o que separa uma IA que
-- opera a empresa de uma IA a que se entregou as chaves.

DO $$ BEGIN
  CREATE TYPE agent_run_status AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_trigger AS ENUM ('CRON', 'USER', 'API', 'WEBHOOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_autonomy AS ENUM ('AUTO', 'REVIEW', 'APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_action_status AS ENUM (
    'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'FAILED', 'REVERTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS agent_run (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  agent                 TEXT NOT NULL,
  trigger               agent_trigger NOT NULL,
  status                agent_run_status NOT NULL DEFAULT 'RUNNING',
  requested_by_user_id  UUID REFERENCES app_user(id) ON DELETE SET NULL,
  input                 JSONB,
  summary               TEXT,
  error                 TEXT,
  model                 TEXT,
  tokens_in             INTEGER,
  tokens_out            INTEGER,
  cost_cents            INTEGER,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_run_company ON agent_run (company_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_agent   ON agent_run (company_id, agent, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_action (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  agent_run_id      UUID NOT NULL REFERENCES agent_run(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL,
  target_table      TEXT NOT NULL,
  target_id         UUID,
  proposal          JSONB NOT NULL,
  rationale         TEXT NOT NULL,
  confidence        NUMERIC(4,3) NOT NULL,
  evidence          JSONB,
  amount            NUMERIC(14,2),
  autonomy          agent_autonomy NOT NULL,
  status            agent_action_status NOT NULL DEFAULT 'PROPOSED',
  journal_entry_id  UUID REFERENCES journal_entry(id) ON DELETE SET NULL,
  applied_at        TIMESTAMPTZ,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Confiança fora de [0,1] é sintoma de medidor quebrado, não de certeza
  -- extrema. Melhor a gravação falhar do que a régua de autonomia receber um
  -- número que ela não sabe interpretar.
  CONSTRAINT ck_agent_action_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_agent_action_company ON agent_action (company_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_run     ON agent_action (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_status  ON agent_action (company_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_action_target  ON agent_action (target_table, target_id);

CREATE TABLE IF NOT EXISTS agent_approval (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  agent_action_id   UUID NOT NULL REFERENCES agent_action(id) ON DELETE CASCADE,
  decision          TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  decided_by_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  note              TEXT,
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_approval_company ON agent_approval (company_id);
CREATE INDEX IF NOT EXISTS idx_agent_approval_action  ON agent_approval (agent_action_id);

-- A partida do razão passa a ter FK real para a execução que a produziu. A
-- coluna nasceu em 0049 sem FK porque agent_run ainda não existia; agora o elo
-- de auditoria fecha dos dois lados — da partida para o agente e de volta.
DO $$ BEGIN
  ALTER TABLE journal_entry
    ADD CONSTRAINT journal_entry_agent_run_id_fkey
    FOREIGN KEY (agent_run_id) REFERENCES agent_run(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ação aplicada é imutável no que importa. Mudar a proposta ou a justificativa
-- depois de executada reescreveria a história — exatamente o que a trilha
-- existe para impedir.
CREATE OR REPLACE FUNCTION assert_applied_action_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPLIED', 'REVERTED') THEN
    IF (NEW.proposal, NEW.rationale, NEW.confidence, NEW.kind, NEW.target_id)
       IS DISTINCT FROM
       (OLD.proposal, OLD.rationale, OLD.confidence, OLD.kind, OLD.target_id) THEN
      RAISE EXCEPTION 'Ação % já foi aplicada: sua proposta e justificativa são imutáveis.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_action_immutable ON agent_action;
CREATE TRIGGER trg_agent_action_immutable
  BEFORE UPDATE ON agent_action
  FOR EACH ROW EXECUTE FUNCTION assert_applied_action_immutable();

-- Uma ação que exige aprovação não pode ser aplicada sem que exista aprovação
-- registrada. A regra é do banco porque é a garantia que precisa valer mesmo
-- quando o caminho de código erra — e o caminho de código, aqui, é uma IA.
CREATE OR REPLACE FUNCTION assert_approval_before_apply() RETURNS TRIGGER AS $$
DECLARE
  aprovacoes INTEGER;
BEGIN
  IF NEW.status = 'APPLIED' AND NEW.autonomy = 'APPROVAL' THEN
    SELECT count(*) INTO aprovacoes
    FROM agent_approval
    WHERE agent_action_id = NEW.id AND decision = 'APPROVED';

    IF aprovacoes = 0 THEN
      RAISE EXCEPTION
        'Ação % exige aprovação e não tem nenhuma registrada — não pode ser aplicada.', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_action_requires_approval ON agent_action;
CREATE TRIGGER trg_agent_action_requires_approval
  BEFORE INSERT OR UPDATE ON agent_action
  FOR EACH ROW EXECUTE FUNCTION assert_approval_before_apply();

ALTER TABLE agent_run      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approval ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON agent_run;
CREATE POLICY tenant_isolation ON agent_run
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DROP POLICY IF EXISTS tenant_isolation ON agent_action;
CREATE POLICY tenant_isolation ON agent_action
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DROP POLICY IF EXISTS tenant_isolation ON agent_approval;
CREATE POLICY tenant_isolation ON agent_approval
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
