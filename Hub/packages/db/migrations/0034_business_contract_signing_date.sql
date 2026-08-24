-- Data de assinatura do vínculo — separada de startDate (vigência) porque um
-- contrato pode entrar em vigor antes de ser fisicamente assinado.
ALTER TABLE "business_contract" ADD COLUMN IF NOT EXISTS "signing_date" date;
