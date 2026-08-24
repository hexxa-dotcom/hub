-- Config global (não por empresa) da feature "Hexxa Insights" — dicas
-- contextuais por IA. Chave da API cifrada, nunca em texto puro.
CREATE TABLE IF NOT EXISTS "ai_insight_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "enabled" boolean NOT NULL DEFAULT false,
  "api_key_encrypted" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_insight_section" (
  "page_key" text PRIMARY KEY,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
