-- MEDIDOR DA COTA DIÁRIA DO ONEFLOW.
--
-- A cota de 500 chamadas por dia é do ESCRITÓRIO inteiro, não de cada empresa
-- e não de cada cron. Hoje há dois consumidores — o envio do razão e a volta
-- das guias — e eles rodam em horários diferentes, sem saber um do outro.
--
-- Sem um medidor compartilhado, cada um respeita o próprio orçamento e juntos
-- estouram o total. Com 50 empresas isso deixa de ser hipótese: a volta
-- sozinha custaria 300 chamadas por dia, e o envio pedia outras 300.
--
-- A conta é por dia no fuso de São Paulo, que é onde o dia vira para o
-- OneFlow — contar em UTC faria o medidor zerar às 21h, três horas antes da
-- cota real.
CREATE TABLE IF NOT EXISTS oneflow_uso_diario (
  dia       DATE PRIMARY KEY,
  chamadas  INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE oneflow_uso_diario ENABLE ROW LEVEL SECURITY;

-- Recurso da plataforma, não do tenant: nenhuma empresa o alcança.
DROP POLICY IF EXISTS sem_acesso_tenant ON oneflow_uso_diario;
CREATE POLICY sem_acesso_tenant ON oneflow_uso_diario USING (false) WITH CHECK (false);
