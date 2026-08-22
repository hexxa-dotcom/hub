-- Achado na auditoria de drift schema x banco: `email_account`/`email_message`
-- estão declaradas no Drizzle e usadas de ponta a ponta por 3 rotas reais
-- (api/emails/connect, /sync, /send) e pelo botão "Conectar E-mail" em
-- Relacionamento e Meu Negócio > E-mails — mas as tabelas NUNCA existiram no
-- banco. A funcionalidade inteira quebrava (relation does not exist) desde
-- sempre; ninguém tinha testado esse fluxo específico ainda.
CREATE TABLE IF NOT EXISTS email_account (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL DEFAULT 'IMAP',
  email_address  TEXT NOT NULL,
  imap_host      TEXT,
  imap_port      TEXT,
  smtp_host      TEXT,
  smtp_port      TEXT,
  username       TEXT,
  password       TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_sync_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

CREATE TABLE IF NOT EXISTS email_message (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES email_account(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  remote_id    TEXT NOT NULL,
  subject      TEXT,
  from_address TEXT NOT NULL,
  to_address   TEXT NOT NULL,
  body_text    TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_message_company_idx ON email_message(company_id);
CREATE INDEX IF NOT EXISTS email_message_customer_idx ON email_message(customer_id);

ALTER TABLE email_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON email_account
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

CREATE POLICY tenant_isolation ON email_message
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
