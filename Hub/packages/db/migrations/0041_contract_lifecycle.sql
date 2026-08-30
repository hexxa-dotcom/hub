-- Ciclo de vida do wizard unificado de Contratos (ver docs/plano em
-- .claude/plans): contrato/aluguel nasce AGUARDANDO_ASSINATURA/PENDING_SIGNATURE
-- e só ativa (e lança financeiro) quando o webhook do DocuSeal confirma
-- SIGNED. Só ADICIONA valores ao enum — nenhum SELECT/INSERT deste arquivo
-- usa os valores novos, então não há o problema clássico de "enum value
-- usado na mesma transação em que foi criado".
ALTER TYPE lease_status ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE lease_status ADD VALUE IF NOT EXISTS 'PENDING_SIGNATURE';

ALTER TABLE business_contract
  ADD COLUMN IF NOT EXISTS pdf_base64 text,
  ADD COLUMN IF NOT EXISTS signature_request_id uuid REFERENCES signature_request(id),
  ADD COLUMN IF NOT EXISTS refusal_reason text;

ALTER TABLE lease
  ADD COLUMN IF NOT EXISTS pdf_base64 text,
  ADD COLUMN IF NOT EXISTS signature_request_id uuid REFERENCES signature_request(id);
