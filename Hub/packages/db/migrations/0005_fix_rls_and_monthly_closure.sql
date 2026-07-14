-- Aplicada em 2026-07-07 via Supabase MCP (registro local).
-- 1. Tabela monthly_closure (definida no schema Drizzle mas nunca criada no banco).
CREATE TABLE IF NOT EXISTS monthly_closure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  new_contracts_count integer NOT NULL DEFAULT 0,
  defaults_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'CLOSED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, reference_month)
);
ALTER TABLE monthly_closure ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON monthly_closure;
CREATE POLICY tenant_isolation ON monthly_closure
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

-- 2. tax_history estava sem RLS.
ALTER TABLE tax_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tax_history;
CREATE POLICY tenant_isolation ON tax_history
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

-- 3. CRÍTICO: demo_all em nfse_config expunha certificado A1 + senha via anon key.
DROP POLICY IF EXISTS demo_all ON nfse_config;

-- 4. Índices para consultas frequentes.
CREATE INDEX IF NOT EXISTS idx_financial_entry_company_month
  ON financial_entry (company_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_service_invoice_company_status
  ON service_invoice (company_id, status);
