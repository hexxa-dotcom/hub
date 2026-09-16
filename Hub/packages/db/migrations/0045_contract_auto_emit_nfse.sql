-- Emissão automática de NFSe pra contrato de recorrência (cron cobranca).
ALTER TABLE "contract" ADD COLUMN "auto_emit_nfse" boolean NOT NULL DEFAULT false;
ALTER TABLE "contract" ADD COLUMN "service_description" text;
