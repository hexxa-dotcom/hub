-- FECHAMENTO EM DOIS ESTÁGIOS.
--
-- São dois fatos diferentes que estavam colapsados num campo só:
--
-- 1. O mês FECHA para o cliente. A IA apura, confere e tranca: ele não lança
--    mais naquele mês. É reversível (reabrir é operação normal) e não sai do
--    sistema — por isso a IA pode fazer sozinha.
--
-- 2. O contador CONFERE e libera. É ele quem assina o balanço, é ele quem tem
--    como avaliar, e é a liberação dele que autoriza a saída para a
--    contabilidade oficial. Sai do sistema e não volta atrás — por isso exige
--    decisão humana.
--
-- Colapsar os dois faria uma das duas coisas erradas: ou a IA mandaria para o
-- contábil sem ninguém olhar, ou o cliente ficaria esperando alguém destravar
-- o mês dele para poder continuar trabalhando.

DO $$ BEGIN
  CREATE TYPE closure_stage AS ENUM (
    'ABERTO',      -- cliente ainda lança
    'FECHADO',     -- IA apurou e trancou; aguardando conferência do contador
    'CONFERIDO',   -- contador conferiu e liberou
    'ENVIADO',     -- entregue à contabilidade oficial (OneFlow)
    'REABERTO'     -- destravado de propósito, com motivo registrado
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE monthly_closure
  ADD COLUMN IF NOT EXISTS stage           closure_stage NOT NULL DEFAULT 'ABERTO',
  ADD COLUMN IF NOT EXISTS closed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_run_id UUID REFERENCES agent_run(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note     TEXT,
  ADD COLUMN IF NOT EXISTS sent_at         TIMESTAMPTZ,
  -- Parecer da conferência: ocorrências, o que a IA resolveu, o que sobrou.
  ADD COLUMN IF NOT EXISTS parecer         JSONB;

-- Linhas antigas foram criadas pelo cron que somava sem conferir. Marcá-las
-- como FECHADO afirmaria uma conferência que nunca houve; ficam ABERTO até
-- passarem pelo agente.
UPDATE monthly_closure SET stage = 'ABERTO' WHERE stage IS NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_closure_stage
  ON monthly_closure (company_id, stage, reference_month);

-- Mês fechado não recebe lançamento. A trava é do banco porque é a garantia
-- que precisa valer mesmo quando o caminho de código erra — e há onze pontos
-- do sistema criando financial_entry.
CREATE OR REPLACE FUNCTION assert_mes_aberto() RETURNS TRIGGER AS $$
DECLARE
  estagio closure_stage;
BEGIN
  SELECT stage INTO estagio
  FROM monthly_closure
  WHERE company_id = NEW.company_id AND reference_month = NEW.reference_month;

  IF estagio IN ('FECHADO', 'CONFERIDO', 'ENVIADO') THEN
    RAISE EXCEPTION
      'O mês % já está fechado. Para lançar nele, o contador precisa reabrir.',
      to_char(NEW.reference_month, 'MM/YYYY');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_entry_mes_aberto ON financial_entry;
CREATE TRIGGER trg_financial_entry_mes_aberto
  BEFORE INSERT ON financial_entry
  FOR EACH ROW EXECUTE FUNCTION assert_mes_aberto();
