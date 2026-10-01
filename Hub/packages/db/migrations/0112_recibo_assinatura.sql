CREATE TABLE receipt_signature_authorization (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES company(id),
 user_id uuid NOT NULL REFERENCES app_user(id), signer_name text NOT NULL, signer_cpf text NOT NULL,
 signer_email text NOT NULL, consent_text text NOT NULL, authorized_at timestamptz NOT NULL DEFAULT now(),
 ip text, user_agent text, revoked_at timestamptz, revoked_by uuid REFERENCES app_user(id)
);
CREATE UNIQUE INDEX receipt_signature_authorization_active ON receipt_signature_authorization(company_id) WHERE revoked_at IS NULL;
ALTER TABLE receipt_signature_authorization ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON receipt_signature_authorization USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hexxa_app') THEN GRANT SELECT,INSERT,UPDATE ON receipt_signature_authorization TO hexxa_app; END IF; END $$;
ALTER TABLE payment_receipt ADD COLUMN pdf_hash text;
ALTER TABLE payment_receipt ADD COLUMN snapshot_hash text;
