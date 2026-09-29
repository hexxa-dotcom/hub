-- Login rápido (Filipe, 29/09/2026): código pessoal de 4 dígitos, cifrado,
-- válido só no aparelho que fez o login completo nos últimos 30 dias.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS codigo_rapido_hash text;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS codigo_rapido_erros int NOT NULL DEFAULT 0;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS ultimo_login_completo timestamptz;
