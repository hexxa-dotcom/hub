-- Perfil Fiscal de Serviço (Múltiplos Serviços por Empresa)
CREATE TABLE IF NOT EXISTS nfse_service_profile (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  nome                        TEXT NOT NULL,
  
  -- Serviço (LC 116/2003)
  item_lista_servico          TEXT NOT NULL,
  codigo_tributacao_municipio TEXT,
  cnae                        TEXT,
  aliquota_iss                NUMERIC(5, 2),
  default_description         TEXT,
  
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nfse_service_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_own_profile" ON nfse_service_profile
  FOR ALL USING (company_id = current_setting('app.company_id', true)::UUID);
