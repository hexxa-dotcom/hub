-- Os dados do ESCRITÓRIO (a contabilidade), que o cliente usa para falar com
-- ela: nome, CNPJ, e-mail e WhatsApp. Antes o botão "Falar com Contador"
-- apontava para um número de exemplo e a tela do contador não gravava nada.
--
-- Uma linha só (id = 1), sem company_id: vale para todas as empresas.

CREATE TABLE IF NOT EXISTS accounting_office (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome        text NOT NULL DEFAULT '',
  cnpj        text,
  email       text,
  whatsapp    text,          -- só dígitos, com DDI e DDD (5547999990000)
  horario     text,          -- ex.: "Seg a sex, 8h às 18h"
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO accounting_office (id, nome) VALUES (1, '') ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
    GRANT SELECT ON accounting_office TO hexxa_app;
  END IF;
END $$;
