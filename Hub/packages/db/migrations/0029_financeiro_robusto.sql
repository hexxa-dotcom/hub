-- Financeiro mais robusto: categorias de verdade, despesa fixa recorrente
-- e anexo de comprovante em lançamentos.

ALTER TABLE "financial_entry" ADD COLUMN IF NOT EXISTS "receipt_base64" text;
ALTER TABLE "financial_entry" ADD COLUMN IF NOT EXISTS "receipt_filename" text;
ALTER TABLE "financial_entry" ADD COLUMN IF NOT EXISTS "receipt_mime_type" text;

CREATE TABLE IF NOT EXISTS "recurring_expense" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "category_name" text,
  "due_day" integer NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "start_month" date NOT NULL,
  "end_month" date,
  "last_generated_month" date,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "recurring_expense_company_id_idx" ON "recurring_expense" ("company_id");
