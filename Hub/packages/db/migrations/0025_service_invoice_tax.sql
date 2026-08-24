-- Persiste o imposto estimado calculado na emissão da NFSe (antes ficava só
-- num financial_entry PAYABLE avulso, sem ligação direta com a nota) — sem
-- isso a UI de emissão e a lista de notas não conseguem mostrar pro cliente
-- quanto ele está pagando de imposto naquela nota específica.
ALTER TABLE "service_invoice" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(14, 2);
ALTER TABLE "service_invoice" ADD COLUMN IF NOT EXISTS "tax_rate" numeric(6, 3);
