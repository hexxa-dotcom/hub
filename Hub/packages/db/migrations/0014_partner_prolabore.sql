-- Sócios reais (módulo "Sócios" — hoje totalmente mockado no front). Adiciona
-- CPF e pró-labore mensal (recorrente) ao cadastro do sócio — o pró-labore
-- entra no Fator R (folha 12 meses) junto com os salários de `employee`.
ALTER TABLE partner ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE partner ADD COLUMN IF NOT EXISTS pro_labore NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE partner ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- `partner` e `partner_distribution` já tinham RLS habilitado (relrowsecurity)
-- mas nunca ganharam a policy — hoje ficam inacessíveis via withTenant()
-- (deny-all seguro por padrão, mas inutilizável). Corrige isso.
DROP POLICY IF EXISTS tenant_isolation ON partner;
CREATE POLICY tenant_isolation ON partner
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DROP POLICY IF EXISTS tenant_isolation ON partner_distribution;
CREATE POLICY tenant_isolation ON partner_distribution
  USING (partner_id IN (SELECT id FROM partner WHERE company_id = app_current_company()))
  WITH CHECK (partner_id IN (SELECT id FROM partner WHERE company_id = app_current_company()));
