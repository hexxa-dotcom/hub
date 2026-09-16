-- Config global (singleton) da conta Asaas da própria Hexxa, editável pelo painel do contador.
CREATE TABLE IF NOT EXISTS "platform_asaas_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"env" text DEFAULT 'sandbox' NOT NULL,
	"api_key_encrypted" text,
	"webhook_token_encrypted" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
