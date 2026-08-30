-- Repasse automático via webhook de SaaS de faturamento do cliente (ex.:
-- telemedicina): contrato de prestação de serviço SAÍDA ganha vínculo com um
-- ID externo (o prestador no SaaS do cliente) + um percentual de repasse.
-- Só ADICIONA valores/colunas — nenhum SELECT/INSERT deste arquivo usa o
-- valor novo do enum na mesma transação em que é criado.
ALTER TYPE integration_kind ADD VALUE IF NOT EXISTS 'REVENUE_SAAS';

ALTER TABLE business_contract
  ADD COLUMN IF NOT EXISTS external_provider_id text,
  ADD COLUMN IF NOT EXISTS repasse_percent numeric(5, 2);

CREATE INDEX IF NOT EXISTS idx_business_contract_external_provider
  ON business_contract (company_id, external_provider_id)
  WHERE external_provider_id IS NOT NULL;
