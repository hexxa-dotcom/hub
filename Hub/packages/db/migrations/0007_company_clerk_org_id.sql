-- Aplicada em 2026-07-07 via Supabase MCP.
ALTER TABLE company ADD COLUMN IF NOT EXISTS clerk_org_id text UNIQUE;
