-- Última leitura COMPLETA da apuração quando a sondagem não achou guia: a
-- empresa sem faturamento não tem DAS, e só a apuração (zerada) encerra o
-- fiscal dela. No máximo a cada 5 dias, a partir do dia 10.
ALTER TABLE oneflow_competencia ADD COLUMN IF NOT EXISTS leitura_completa_em timestamptz;
