-- ENVIO DA NOTA AO MÓDULO FISCAL DO ONEFLOW.
--
-- É a perna que faltava para o ciclo fechar. Hoje o Hub manda ao OneFlow o
-- razão CONTÁBIL, e só. O módulo FISCAL de lá — que é quem apura o Simples e
-- gera a guia do DAS — nunca recebeu nota nenhuma, e por isso devolve
-- apuração zerada em toda competência.
--
-- Sem esta perna, a mão de volta (guias) não tem o que trazer: ela pergunta
-- por um imposto que ninguém apurou, porque não havia receita escriturada
-- para apurar.
--
--   Hub emite nota → OneFlow apura → OneFlow gera guia → Hub traz guia →
--   cliente paga
--
-- O primeiro passo é este arquivo.

-- ── 1. Qual perfil fiscal gerou a nota ──────────────────────────────────
--
-- O envio exige o código da LC 116/2003 ("17.19", "1.01"), e ele vive em
-- `nfse_service_profile`. A nota é emitida COM esse perfil, mas não guardava
-- qual foi — o código era usado na montagem do XML e descartado.
--
-- Sem isto, mandar uma nota já emitida ao OneFlow exigiria adivinhar o item
-- da lista de serviços, e item errado significa ISS calculado errado na
-- apuração. Guardar a referência é mais honesto que reconstruir por
-- heurística.
ALTER TABLE service_invoice
  ADD COLUMN IF NOT EXISTS nfse_service_profile_id UUID REFERENCES nfse_service_profile(id);

COMMENT ON COLUMN service_invoice.nfse_service_profile_id IS
  'Perfil fiscal usado na emissão. Origem do código LC 116 exigido pelo OneFlow.';

-- ── 2. Registro do que já foi enviado ao módulo fiscal ──────────────────
--
-- Mesma razão da `oneflow_envio` do razão: a idempotência do lado de cá não
-- diz nada sobre o que chegou do lado de lá, e reenviar uma nota depois de
-- uma falha de rede duplicaria RECEITA na apuração — o erro que faz o cliente
-- pagar imposto a mais e só aparece na guia.
CREATE TABLE IF NOT EXISTS oneflow_nfse (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  service_invoice_id UUID NOT NULL REFERENCES service_invoice(id) ON DELETE CASCADE,
  /** AAAAMM — a competência com que a nota entrou lá. */
  competencia        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ENVIADA',
  erro               TEXT,
  enviado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma nota entra uma vez. É esta restrição que torna seguro reexecutar um
-- envio interrompido no meio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oneflow_nfse_nota
  ON oneflow_nfse (service_invoice_id) WHERE status = 'ENVIADA';
CREATE INDEX IF NOT EXISTS idx_oneflow_nfse_company
  ON oneflow_nfse (company_id, competencia);

ALTER TABLE oneflow_nfse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON oneflow_nfse;
CREATE POLICY tenant_isolation ON oneflow_nfse
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
