-- Contrato de prestação de serviço da Hexxa com o CLIENTE (empresa), gerado
-- pelo painel do contador (/contador/contratos). Não confundir com a tabela
-- `contract`, que é o contrato do próprio tenant com OS CLIENTES DELE.
CREATE TABLE IF NOT EXISTS accounting_contract (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  plano            TEXT NOT NULL,
  valor            NUMERIC(14, 2) NOT NULL,
  inicio           DATE NOT NULL,
  vigencia_meses   INTEGER, -- null = indeterminado
  servicos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacao       TEXT,
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounting_contract ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON accounting_contract
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
