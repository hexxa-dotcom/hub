-- Aplicada manualmente (drizzle-kit generate estava travado numa divergência
-- não relacionada em nfse_config — histórico de migrations fora de sincronia
-- com o schema real do banco). Este arquivo documenta a mudança; não está
-- registrado no journal do drizzle-kit.
ALTER TABLE membership ADD COLUMN IF NOT EXISTS authorized boolean NOT NULL DEFAULT false;
