-- NFSe config por empresa: cadastro fiscal + certificado A1 armazenado no banco
CREATE TABLE IF NOT EXISTS nfse_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  UUID NOT NULL UNIQUE REFERENCES company(id) ON DELETE CASCADE,
  -- Ambiente de emissão
  ambiente                    TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  -- Dados do emitente
  cnpj                        TEXT,
  razao_social                TEXT,
  nome_fantasia               TEXT,
  inscricao_municipal         TEXT,
  codigo_municipio            TEXT,   -- IBGE 7 dígitos
  optante_simples             BOOLEAN NOT NULL DEFAULT true,
  regime_especial             TEXT,   -- regEspTrib (0–6), padrão 0
  regime_apuracao             TEXT,   -- Regime de apuração tributária
  emitir_exterior             BOOLEAN NOT NULL DEFAULT false,
  -- Endereço do emitente (obrigatório no DPS XML)
  cep                         TEXT,
  logradouro                  TEXT,
  numero                      TEXT,
  complemento                 TEXT,
  bairro                      TEXT,
  uf                          TEXT,   -- UF 2 letras ex: PR, SP
  -- Contato
  email_contato               TEXT,
  telefone                    TEXT,
  -- Serviço (LC 116/2003)
  item_lista_servico          TEXT,   -- ex: "17.19"
  codigo_tributacao_municipio TEXT,
  cnae                        TEXT,   -- Código CNAE ex: "6920601"
  aliquota_iss                NUMERIC(5, 2),
  -- Numeração da DPS
  serie_dps                   TEXT NOT NULL DEFAULT '00001',
  prox_numero_dps             INTEGER NOT NULL DEFAULT 1,
  -- Certificado A1 (.pfx em base64 + senha) — armazenado por tenant
  -- ATENÇÃO: em produção considere criptografar com pgsodium / Vault do Supabase
  cert_pfx_b64                TEXT,
  cert_password               TEXT,
  -- Metadados
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nfse_config ENABLE ROW LEVEL SECURITY;

-- Política: empresa só acessa seus próprios dados
CREATE POLICY "company_own" ON nfse_config
  FOR ALL USING (company_id = current_setting('app.company_id', true)::UUID);
