ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "asaas_customer_id" text;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "asaas_subscription_id" text;
