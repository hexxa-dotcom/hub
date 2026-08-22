-- "Tarefas & Funil" dentro de Relacionamento era 100% mockado (seedTarefas()
-- hardcoded, criar/mudar status/excluir só mexiam em estado local do React).
CREATE TABLE IF NOT EXISTS crm_task (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customer(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  titulo       TEXT NOT NULL,
  descricao    TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  prioridade   TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  prazo        DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_task_company_idx ON crm_task(company_id);

ALTER TABLE crm_task ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON crm_task
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
