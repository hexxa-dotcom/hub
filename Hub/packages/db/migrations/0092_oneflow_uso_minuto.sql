-- Chamadas ao OneFlow por minuto, somando TODOS os processos (rotinas, telas,
-- scripts). O limite de lá é 60/min, e estourar devolve erro disfarçado de
-- sucesso; o espaçamento de 1,1s só valia dentro de cada processo.
CREATE TABLE IF NOT EXISTS oneflow_uso_minuto (
  minuto    timestamptz PRIMARY KEY,
  chamadas  int NOT NULL DEFAULT 0
);
ALTER TABLE oneflow_uso_minuto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS so_servico ON oneflow_uso_minuto;
CREATE POLICY so_servico ON oneflow_uso_minuto USING (false);
