-- Colaboradores PJ: alíneas pra vigência de contrato, dia de vencimento e
-- vínculo com o business_contract que gera o pagamento recorrente
-- automaticamente (reaproveita a mesma máquina de lançamentos de /contratos,
-- em vez de duplicar lógica de cobrança recorrente pra PJ).
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "cnpj" text;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "contract_end_date" date;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "payment_due_day" integer;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "business_contract_id" uuid REFERENCES "business_contract"("id");
