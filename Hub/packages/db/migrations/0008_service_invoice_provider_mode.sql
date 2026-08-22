-- Marca se a NFSe foi emitida de verdade ('gov') ou em modo de teste ('mock',
-- sem certificado A1 configurado). Sem essa coluna era impossível distinguir
-- na UI uma nota real de uma nota fake — as duas apareciam como "Emitida".
ALTER TABLE "service_invoice" ADD COLUMN IF NOT EXISTS "provider_mode" text;
