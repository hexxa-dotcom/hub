-- Código de verificação do contrato: impresso em todas as páginas do PDF,
-- com o endereço /v/<código>, onde qualquer pessoa (inclusive de fora do
-- Hub) confere quem assinou, quando, e se o arquivo que tem nas mãos é o
-- original (pelo hash). O mesmo código nos dois lados do contrato.
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS verification_code text;
CREATE INDEX IF NOT EXISTS business_contract_verification_code_idx ON business_contract (verification_code) WHERE verification_code IS NOT NULL;
