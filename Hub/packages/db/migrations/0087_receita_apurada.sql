-- A receita que o OneFlow usou na apuração do Simples, por competência. É o
-- outro lado da conferência "notas emitidas × o que foi para os livros".
CREATE TABLE IF NOT EXISTS receita_apurada (
  company_id  uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  competencia varchar(7) NOT NULL, -- AAAA-MM
  receita     numeric(14, 2) NOT NULL,
  recebida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, competencia)
);
ALTER TABLE receita_apurada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON receita_apurada;
CREATE POLICY tenant_isolation ON receita_apurada
  USING (company_id = app_current_company()) WITH CHECK (company_id = app_current_company());
