-- Rode isto no SQL Editor do Supabase (dashboard do projeto dgixajsmecysehwytlav).
-- Cria um role de aplicação SEM BYPASSRLS, para que as policies de RLS
-- (que hoje existem mas são ignoradas pelo role "postgres") passem a valer
-- de verdade para as rotas do portal do cliente.
--
-- Troque a senha abaixo por uma sua antes de rodar.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
    CREATE ROLE hexxa_app LOGIN PASSWORD 'SUBSTITUA_A_SENHA_AQUI'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE hexxa_app WITH LOGIN PASSWORD 'SUBSTITUA_A_SENHA_AQUI'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO hexxa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hexxa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hexxa_app;

-- Garante que tabelas criadas por migrations futuras também sejam acessíveis
-- por este role, sem precisar rodar isto de novo.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hexxa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hexxa_app;

-- Conferir depois de rodar (deve mostrar rolbypassrls = false):
-- select rolname, rolbypassrls, rolsuper from pg_roles where rolname = 'hexxa_app';
