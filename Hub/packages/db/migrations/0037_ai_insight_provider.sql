-- Suporte a mais de um provedor de IA (Anthropic ou Gemini) na Hexxa Insights.
ALTER TABLE "ai_insight_config" ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'anthropic';
