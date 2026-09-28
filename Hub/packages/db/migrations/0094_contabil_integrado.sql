-- O fiscal/folha do OneFlow já lançam no contábil de lá nesta competência?
--   true  → o Hub NÃO manda receita (da nota), provisão do DAS e folha (duplicaria);
--   false → o Hub manda (decisão de 28/09/2026: o Hub monta todas as partidas);
--   NULL  → ainda não conferido: não manda até conferir (seguro).
-- Conferido pelo razão do OneFlow: lançamento lá que não é do Hub (sem HUB-).
ALTER TABLE oneflow_competencia ADD COLUMN IF NOT EXISTS contabil_integrado boolean;
ALTER TABLE oneflow_competencia ADD COLUMN IF NOT EXISTS contabil_conferido_em timestamptz;
