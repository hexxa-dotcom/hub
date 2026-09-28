-- O que já voltou do OneFlow em cada competência, por empresa. Antes a volta
-- considerava a empresa "pronta" quando QUALQUER guia com arquivo chegava — a
-- guia da folha (DCTFWeb, FGTS) que saísse depois nunca era buscada. Agora o
-- fiscal (DAS/apuração) e a folha (recibos + guias) têm marcação própria.
CREATE TABLE IF NOT EXISTS oneflow_competencia (
  company_id    uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  competencia   varchar(6) NOT NULL, -- AAAAMM
  fiscal_ok     boolean NOT NULL DEFAULT false,
  folha_ok      boolean NOT NULL DEFAULT false,
  -- 'Fechada', 'Aberta', 'SEM_MODULO'…: o status da folha lá, na última consulta.
  folha_status  text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, competencia)
);
ALTER TABLE oneflow_competencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON oneflow_competencia;
CREATE POLICY tenant_isolation ON oneflow_competencia
  USING (company_id = app_current_company()) WITH CHECK (company_id = app_current_company());
