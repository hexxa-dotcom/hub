-- "Propostas e Orçamentos" era 100% mockado (4 propostas fake hardcoded no
-- front, criar/editar/excluir só mexiam em estado local do React).
CREATE TABLE IF NOT EXISTS proposal (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  numero      TEXT NOT NULL,
  cliente     TEXT NOT NULL,
  titulo      TEXT NOT NULL,
  validade    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'rejeitada', 'expirada')),
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_item (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposal(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  qtd         NUMERIC(10, 2) NOT NULL DEFAULT 1,
  valor       NUMERIC(14, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS proposal_company_idx ON proposal(company_id);
CREATE INDEX IF NOT EXISTS proposal_item_proposal_idx ON proposal_item(proposal_id);

ALTER TABLE proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON proposal
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

CREATE POLICY tenant_isolation ON proposal_item
  USING (proposal_id IN (SELECT id FROM proposal WHERE company_id = app_current_company()))
  WITH CHECK (proposal_id IN (SELECT id FROM proposal WHERE company_id = app_current_company()));
