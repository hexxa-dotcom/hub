-- Drift real entre o schema Drizzle e o banco: `financial_entry.external_id`
-- estava declarado no schema (usado pelo webhook do Asaas pra guardar o ID
-- do pagamento) mas a coluna nunca existiu na tabela de verdade. Qualquer
-- insert tipado do Drizzle em financial_entry (webhook do Asaas, geração de
-- pró-labore, geração de recebível de contrato) vinha quebrando em silêncio
-- há tempo — só não dava erro visível porque a maioria dos módulos grava
-- com SQL cru em vez do insert tipado.
ALTER TABLE financial_entry ADD COLUMN IF NOT EXISTS external_id TEXT;
