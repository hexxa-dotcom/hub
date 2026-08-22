-- Contrato comercial do PRÓPRIO tenant com os clientes/fornecedores dele
-- (módulo "Meu Negócio" > Contratos). Não confundir com `contract` (cliente
-- de assessoria contábil + Asaas) nem com `accounting_contract` (contrato da
-- Hexxa com o tenant, gerado pelo painel do contador).
--
-- ENTRADA = o tenant presta o serviço → gera contas a receber (RECEIVABLE).
-- SAIDA   = o tenant contrata o serviço → gera contas a pagar (PAYABLE).
--
-- Quando a contraparte (identificada pelo CNPJ) também é uma empresa
-- cadastrada na Hexxa, o sistema cria automaticamente o contrato espelho do
-- lado dela (tipo invertido) e liga os dois via mirror_contract_id — assim
-- as duas partes veem o mesmo contrato, cada uma com o lançamento financeiro
-- correto (quem presta recebe, quem contrata paga).
CREATE TABLE IF NOT EXISTS business_contract (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  type                   TEXT NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA')),
  title                  TEXT NOT NULL,
  party_name             TEXT NOT NULL,
  party_cnpj             TEXT,
  counterparty_company_id UUID REFERENCES company(id),
  mirror_contract_id     UUID REFERENCES business_contract(id),
  value                  NUMERIC(14, 2) NOT NULL,
  due_day                INTEGER NOT NULL,
  start_date             DATE NOT NULL,
  end_date               DATE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'CANCELADO')),
  auto_emit_nfse         BOOLEAN NOT NULL DEFAULT false,
  last_nfse_emitted      BOOLEAN NOT NULL DEFAULT false,
  nfse_number            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_contract_company_idx ON business_contract(company_id);
CREATE INDEX IF NOT EXISTS business_contract_cnpj_idx ON business_contract(party_cnpj);

ALTER TABLE business_contract ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON business_contract
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
