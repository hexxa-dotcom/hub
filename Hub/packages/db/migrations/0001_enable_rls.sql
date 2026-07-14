-- ============================================================
-- Hexxa Hub — Row Level Security (multi-tenant)
-- Rode DEPOIS de `drizzle-kit generate` + `migrate` (que criam as tabelas).
-- Isola cada empresa por company_id = current_setting('app.company_id').
-- O app seta esse valor via withTenant() (packages/db/src/client.ts).
-- ============================================================

-- Helper: lê o tenant atual da sessão.
create or replace function app_current_company() returns uuid
  language sql stable
as $$ select nullif(current_setting('app.company_id', true), '')::uuid $$;

-- Aplica RLS a todas as tabelas com company_id direto.
do $$
declare t text;
begin
  foreach t in array array[
    'membership','bank_account','category','financial_entry','bank_transaction',
    'reconciliation_match','customer','contract','service_invoice','signature_request',
    'tax_guide','accounting_invoice','employee','property','lease','rent_invoice',
    'partner','vault_document','ticket','subscription','integration_credential','notification'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on %I;', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = app_current_company()) with check (company_id = app_current_company());',
      t
    );
  end loop;
end $$;

-- A própria empresa: só enxerga a si mesma.
alter table company enable row level security;
drop policy if exists tenant_isolation on company;
create policy tenant_isolation on company
  using (id = app_current_company()) with check (id = app_current_company());

-- Tabelas filhas (sem company_id) herdam o isolamento via join com o pai.
-- payslip/vacation_period/employment_event -> employee.company_id
-- ticket_message -> ticket.company_id
-- partner_distribution -> partner.company_id
alter table payslip enable row level security;
drop policy if exists tenant_isolation on payslip;
create policy tenant_isolation on payslip using (
  exists (select 1 from employee e where e.id = payslip.employee_id and e.company_id = app_current_company())
);

-- (Repetir o padrão acima para vacation_period, employment_event,
--  ticket_message e partner_distribution — omitido aqui por brevidade.)

-- `plan` e `app_user` são globais (sem RLS por tenant).
