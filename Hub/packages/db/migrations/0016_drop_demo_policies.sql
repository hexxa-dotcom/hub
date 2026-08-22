-- SEGURANÇA: remove policies "demo_*" que ficaram no banco liberando leitura
-- (e em alguns casos escrita) de customer/employee/financial_entry/
-- profit_distribution/service_invoice para os roles `anon`/`authenticated`
-- do Supabase, sem qualquer verificação de sessão — bastava ter a chave
-- pública (NEXT_PUBLIC_SUPABASE_ANON_KEY, que fica embutida no bundle JS do
-- site) para ler e, em parte das tabelas, ATÉ INSERIR/ATUALIZAR dados reais
-- da empresa 'ad35fdf7-3e07-4ad1-9d5d-ffe1c0356109' (Hexx Serviços Digitais).
-- O acesso legítimo já passa por withTenant()/RLS `tenant_isolation`.
DROP POLICY IF EXISTS demo_select ON customer;
DROP POLICY IF EXISTS demo_insert ON customer;
DROP POLICY IF EXISTS demo_select ON employee;
DROP POLICY IF EXISTS demo_select ON financial_entry;
DROP POLICY IF EXISTS demo_insert ON financial_entry;
DROP POLICY IF EXISTS demo_select ON profit_distribution;
DROP POLICY IF EXISTS demo_insert ON profit_distribution;
DROP POLICY IF EXISTS demo_select ON service_invoice;
DROP POLICY IF EXISTS demo_insert ON service_invoice;
DROP POLICY IF EXISTS demo_update ON service_invoice;
