-- Não cria lançamentos: cada recibo comprova um recebível já registrado.
CREATE TABLE payment_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id),
  financial_entry_id uuid NOT NULL REFERENCES financial_entry(id),
  number text NOT NULL,
  data jsonb NOT NULL,
  pdf_base64 text NOT NULL,
  fiscal_eligible boolean NOT NULL DEFAULT false,
  oneflow_status text NOT NULL DEFAULT 'NAO_APLICAVEL'
    CHECK (oneflow_status IN ('NAO_APLICAVEL', 'AGUARDANDO_CONFIGURACAO', 'PENDENTE', 'ENVIANDO', 'ENVIADO', 'INCERTO', 'ERRO')),
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, financial_entry_id),
  UNIQUE (company_id, number)
);

CREATE TABLE receipt_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id),
  financial_entry_id uuid REFERENCES financial_entry(id),
  lease_id uuid REFERENCES lease(id),
  next_date date NOT NULL,
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31),
  active boolean NOT NULL DEFAULT true,
  send_email boolean NOT NULL DEFAULT false,
  last_error text,
  last_run date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((financial_entry_id IS NOT NULL AND lease_id IS NULL AND day_of_month IS NULL)
      OR (financial_entry_id IS NULL AND lease_id IS NOT NULL AND day_of_month IS NOT NULL))
);
CREATE UNIQUE INDEX receipt_schedule_active_entry ON receipt_schedule(company_id, financial_entry_id) WHERE active AND financial_entry_id IS NOT NULL;
CREATE UNIQUE INDEX receipt_schedule_active_lease ON receipt_schedule(company_id, lease_id) WHERE active AND lease_id IS NOT NULL;

CREATE TABLE receipt_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id),
  receipt_id uuid NOT NULL REFERENCES payment_receipt(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE receipt_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id),
  receipt_id uuid NOT NULL REFERENCES payment_receipt(id),
  recipient text NOT NULL,
  idempotency_key text UNIQUE,
  status text NOT NULL CHECK (status IN ('ENVIANDO', 'ENVIADO', 'ERRO')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_receipt','receipt_schedule','receipt_share','receipt_delivery'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid) WITH CHECK (company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid)', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO hexxa_app', t);
    END IF;
  END LOOP;
END $$;
