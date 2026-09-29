-- Perfil de visualização da tela de Início: BASICO (4 blocos essenciais, para
-- quem é leigo), PERSONALIZADO (o cliente escolhe os blocos) ou COMPLETO (tudo).
-- Por empresa enquanto o login está desligado; vira por usuário depois.
ALTER TABLE company ADD COLUMN IF NOT EXISTS inicio_perfil text NOT NULL DEFAULT 'BASICO';
ALTER TABLE company ADD COLUMN IF NOT EXISTS inicio_blocos jsonb;
ALTER TABLE company DROP CONSTRAINT IF EXISTS company_inicio_perfil_check;
ALTER TABLE company ADD CONSTRAINT company_inicio_perfil_check CHECK (inicio_perfil IN ('BASICO', 'PERSONALIZADO', 'COMPLETO'));
