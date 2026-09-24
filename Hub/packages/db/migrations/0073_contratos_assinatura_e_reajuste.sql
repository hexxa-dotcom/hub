-- Contratos: modelo, reajuste pelo índice e assinatura dos dois lados.
--
-- Antes só a outra parte assinava (a empresa que criava o contrato nunca
-- assinava), o reajuste mudava o valor do contrato mas não as parcelas já
-- lançadas, e não havia data de reajuste nem índice.
--
-- Assinatura:
--   HUB      — as duas partes usam o Hub: cada uma assina dentro do sistema
--              (nome, CPF, data/hora, IP e o hash do PDF ficam registrados
--              em contract_signature). Assinatura eletrônica simples.
--   DOCUSEAL — a outra parte está fora do Hub: envelope do DocuSeal com os
--              dois signatários; a empresa assina ali mesmo, embutido.
--   FORA     — o contrato já veio assinado (PDF anexado).

ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS adjustment_index text NOT NULL DEFAULT 'IPCA';
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS next_adjustment_date date;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS signature_method text;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS document_hash text;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS own_sign_url text;
-- false no lado espelho: quem recebeu o contrato de outra empresa do Hub.
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS initiated_here boolean NOT NULL DEFAULT true;
ALTER TABLE business_contract ADD COLUMN IF NOT EXISTS party_email text;

-- Contratos antigos: primeiro reajuste um ano depois do início.
UPDATE business_contract
   SET next_adjustment_date = (start_date + interval '1 year')::date
 WHERE next_adjustment_date IS NULL AND status = 'ATIVO';

CREATE TABLE IF NOT EXISTS contract_signature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES business_contract(id) ON DELETE CASCADE,
  user_id uuid,
  signer_name text NOT NULL,
  signer_cpf text,
  signer_email text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  document_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS contract_signature_contract_idx ON contract_signature(contract_id);

ALTER TABLE contract_signature ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_signature;
CREATE POLICY tenant_isolation ON contract_signature
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
    GRANT SELECT, INSERT ON contract_signature TO hexxa_app;
  END IF;
END $$;

-- As restrições antigas só aceitavam ATIVO/CANCELADO e ENTRADA/SAIDA — o
-- contrato "aguardando assinatura" e o mútuo nunca conseguiam ser gravados.
ALTER TABLE business_contract DROP CONSTRAINT IF EXISTS business_contract_status_check;
ALTER TABLE business_contract ADD CONSTRAINT business_contract_status_check
  CHECK (status IN ('AGUARDANDO_ASSINATURA', 'ATIVO', 'CANCELADO', 'RECUSADO', 'EXPIRADO'));
ALTER TABLE business_contract DROP CONSTRAINT IF EXISTS business_contract_type_check;
ALTER TABLE business_contract ADD CONSTRAINT business_contract_type_check
  CHECK (type IN ('ENTRADA', 'SAIDA', 'MUTUO_ATIVO', 'MUTUO_PASSIVO'));
