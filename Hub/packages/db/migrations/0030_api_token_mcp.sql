-- Tokens de API por empresa, pra conectar um assistente de IA (Claude, ChatGPT)
-- via o servidor MCP em /api/mcp — acesso de leitura aos dados financeiros.
CREATE TABLE IF NOT EXISTS "api_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "token_prefix" text NOT NULL,
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "api_token_company_id_idx" ON "api_token" ("company_id");
CREATE INDEX IF NOT EXISTS "api_token_hash_idx" ON "api_token" ("token_hash");
