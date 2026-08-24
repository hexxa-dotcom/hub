-- Venda avulsa sem nota fiscal — segunda fonte de faturamento além da NFSe.
CREATE TABLE IF NOT EXISTS "sale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customer"("id"),
  "description" text NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "payment_method" text NOT NULL DEFAULT 'OUTRO',
  "sale_date" date NOT NULL,
  "reference_month" date NOT NULL,
  "received" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sale_company_id_idx" ON "sale" ("company_id");
