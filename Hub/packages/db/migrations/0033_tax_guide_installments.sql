-- Parcelamentos: agrupa várias linhas de tax_guide (uma por parcela) sob um
-- mesmo installment_group_id, gerado pelo contador em /contador/clientes/[id]/guias.
ALTER TABLE "tax_guide" ADD COLUMN IF NOT EXISTS "installment_group_id" uuid;
ALTER TABLE "tax_guide" ADD COLUMN IF NOT EXISTS "installment_number" integer;
ALTER TABLE "tax_guide" ADD COLUMN IF NOT EXISTS "installment_count" integer;
CREATE INDEX IF NOT EXISTS "tax_guide_installment_group_idx" ON "tax_guide" ("installment_group_id");
