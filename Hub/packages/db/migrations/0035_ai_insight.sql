-- Cache de dicas contextuais por IA — uma por empresa+página, regenerada só
-- quando o contexto muda ou o cache expira (evita chamar o modelo toda hora).
CREATE TABLE IF NOT EXISTS "ai_insight" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
  "page_key" text NOT NULL,
  "content" text NOT NULL,
  "context_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_insight_company_page_idx" ON "ai_insight" ("company_id", "page_key");
