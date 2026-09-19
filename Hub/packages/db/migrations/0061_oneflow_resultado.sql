-- Resultado oficial do exercício, espelhado do balancete do OneFlow.
--
-- A distribuição de lucros calculava o lucro como receitas menos despesas do
-- módulo financeiro. Errava para cima e em silêncio: o DAS e a folha que vêm
-- do OneFlow moram em outras tabelas e não entravam, e o ano inteiro era
-- somado — inclusive meses que ainda não aconteceram. Para empresas cuja
-- receita vive no OneFlow, errava para zero.
--
-- O lucro que vale é o da contabilidade oficial. Esta tabela guarda, por
-- empresa e competência, o resultado acumulado no exercício até ela, lido do
-- balancete de lá. Só é preenchida para meses ENVIADOS — liberados pelo
-- contador e inteiros no OneFlow —, para que o número nunca misture mês
-- conferido com mês em aberto.

CREATE TABLE IF NOT EXISTS oneflow_resultado (
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  -- false quando o contábil da empresa não está implantado no OneFlow
  -- (balancete vazio, idPlanoContas 0). Aí não existe lucro oficial.
  contabil_implantado boolean NOT NULL,
  receitas numeric(15,2),
  custos_despesas numeric(15,2),
  resultado numeric(15,2),
  -- O balancete inteiro, para auditoria: de onde o número saiu.
  balancete jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, reference_month)
);

ALTER TABLE oneflow_resultado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON oneflow_resultado;
CREATE POLICY tenant_isolation ON oneflow_resultado
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
