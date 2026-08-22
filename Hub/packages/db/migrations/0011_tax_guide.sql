-- A tabela `tax_guide` já existia (schema/accounting.ts) mas sem RLS —
-- estava exposta via anon key sem isolamento por tenant. Só habilita RLS.
CREATE INDEX IF NOT EXISTS "tax_guide_company_id_idx" ON "tax_guide" ("company_id");

ALTER TABLE tax_guide ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tax_guide;
CREATE POLICY tenant_isolation ON tax_guide
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
