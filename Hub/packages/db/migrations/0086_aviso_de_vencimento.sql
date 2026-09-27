-- Avisos de documento vencendo já enviados: um por documento, validade e marco
-- (30, 15, 7 dias, vencido). Documento renovado = validade nova = avisos de novo.
CREATE TABLE IF NOT EXISTS aviso_de_vencimento (
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  item       text NOT NULL,
  validade   date NOT NULL,
  marco      int  NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, item, validade, marco)
);
ALTER TABLE aviso_de_vencimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON aviso_de_vencimento;
CREATE POLICY tenant_isolation ON aviso_de_vencimento
  USING (company_id = app_current_company()) WITH CHECK (company_id = app_current_company());
