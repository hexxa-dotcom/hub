-- Nível de acesso do token: 'read' (consulta, usado pelo MCP) ou 'write'
-- (também pode lançar despesa/faturamento via API pra integração externa).
ALTER TABLE "api_token" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'read';
