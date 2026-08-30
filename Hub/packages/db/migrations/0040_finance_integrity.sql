-- Índices de company_id nas tabelas novas de conciliação/integração (mesmo
-- motivo do 0039: sem índice, filtro por empresa vira sequential scan).
CREATE INDEX IF NOT EXISTS idx_bank_transaction_company ON bank_transaction (company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_match_company ON reconciliation_match (company_id);
CREATE INDEX IF NOT EXISTS idx_integration_credential_company ON integration_credential (company_id);

-- reconciliation_match é documentada como ligação 1:1 entre transação
-- bancária e lançamento, mas nada impedia duas transações diferentes
-- casarem com o mesmo lançamento (ou a mesma transação ser casada duas
-- vezes) — cada índice único abaixo garante um dos dois lados do 1:1.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reconciliation_match_bank_transaction ON reconciliation_match (bank_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reconciliation_match_financial_entry ON reconciliation_match (financial_entry_id);

-- external_id (cobrança do gateway) deve ser único quando presente — evita
-- duas cobranças diferentes apontando pro mesmo lançamento e mascarando
-- reentregas de webhook como se fossem pagamentos distintos. NULLs não
-- colidem entre si num índice único do Postgres, então lançamentos sem
-- cobrança de gateway (a maioria) não são afetados.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entry_external_id ON financial_entry (external_id) WHERE external_id IS NOT NULL;
