ALTER TABLE "signature_request" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "signature_request" ADD COLUMN IF NOT EXISTS "signer_name" text;
ALTER TABLE "signature_request" ADD COLUMN IF NOT EXISTS "signer_email" text;
ALTER TABLE "signature_request" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
