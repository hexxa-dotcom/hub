-- "Arquivos Permanentes" (minha-contabilidade/arquivos) era uma lista de 9
-- documentos 100% hardcoded no front (alvará, CND, contrato social — nomes e
-- datas de vencimento inventados), com botão "Baixar" que não baixava nada.
CREATE TABLE IF NOT EXISTS company_document (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('ALVARA', 'CONTRATO', 'CND', 'OUTRO')),
  name        TEXT NOT NULL,
  issued_at   DATE,
  expires_at  DATE,
  file_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_document_company_idx ON company_document(company_id);

ALTER TABLE company_document ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON company_document
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
