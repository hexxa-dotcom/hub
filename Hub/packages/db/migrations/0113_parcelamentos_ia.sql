CREATE TABLE tax_installment_import (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES company(id),
 source_hash text NOT NULL,source_name text NOT NULL,source_pdf text NOT NULL,extracted_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,source_hash)
);
CREATE TABLE tax_installment_plan (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES company(id),
 description text NOT NULL,tax text NOT NULL,authority text NOT NULL,agreement text NOT NULL,
 total_amount numeric(14,2) NOT NULL CHECK(total_amount>0),installment_count integer NOT NULL CHECK(installment_count BETWEEN 2 AND 240),
 source_hash text NOT NULL,source_name text,source_pdf text,details jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,source_hash)
);
CREATE UNIQUE INDEX tax_installment_plan_agreement ON tax_installment_plan(company_id,lower(authority),lower(agreement)) WHERE agreement<>'';
ALTER TABLE tax_guide ADD COLUMN installment_estimated boolean NOT NULL DEFAULT false;
ALTER TABLE tax_guide ADD COLUMN installment_managed boolean NOT NULL DEFAULT false;
ALTER TABLE tax_guide ADD COLUMN requested_at timestamptz;
CREATE UNIQUE INDEX tax_guide_installment_number_unique ON tax_guide(company_id,installment_group_id,installment_number) WHERE installment_managed;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tax_installment_import','tax_installment_plan'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid) WITH CHECK (company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid)',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hexxa_app') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO hexxa_app',t); END IF;
 END LOOP;
END $$;
