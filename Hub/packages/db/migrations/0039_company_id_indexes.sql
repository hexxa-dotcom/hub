-- Índices em company_id (e ticket_message.ticket_id) para as tabelas
-- centrais que só tinham PK. Sem isso, toda query filtrada por empresa
-- vira sequential scan conforme a base cresce — mesmo tipo de degradação
-- que contribuiu pro travamento de produção em 2026-08-24.
CREATE INDEX IF NOT EXISTS idx_ticket_company ON ticket (company_id);
CREATE INDEX IF NOT EXISTS idx_ticket_message_ticket ON ticket_message (ticket_id);
CREATE INDEX IF NOT EXISTS idx_employee_company ON employee (company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoice_company ON accounting_invoice (company_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_company ON bank_account (company_id);
CREATE INDEX IF NOT EXISTS idx_category_company ON category (company_id);
CREATE INDEX IF NOT EXISTS idx_partner_company ON partner (company_id);
CREATE INDEX IF NOT EXISTS idx_property_company ON property (company_id);
CREATE INDEX IF NOT EXISTS idx_customer_company ON customer (company_id);
CREATE INDEX IF NOT EXISTS idx_contract_company ON contract (company_id);
CREATE INDEX IF NOT EXISTS idx_notification_company ON notification (company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_company ON subscription (company_id);
