-- A aba "Contratos" dentro de Relacionamento lia/gravava contrato só em
-- estado local do React (criar e remover não persistiam) e até o lado
-- "real" da leitura fabricava a data de término (sempre created_at + 365
-- dias, nunca a data real do contrato). Faltavam colunas pra guardar isso
-- de verdade.
ALTER TABLE contract ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE contract ADD COLUMN IF NOT EXISTS notes TEXT;
