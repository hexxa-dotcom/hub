-- Entrega de documentos do escritório ao cliente, com protocolo e histórico.
--
-- Quando o cliente diz "não recebi a guia", o escritório precisava provar o
-- contrário e não tinha como: a guia simplesmente existia numa tela. Cada
-- entrega agora tem um protocolo (HEXX-2026-000123) e uma linha do tempo —
-- enviado, e-mail enviado ou não, primeira abertura, cada download e a
-- confirmação de recebimento pelo cliente.
--
-- Vale para os dois caminhos:
--   CONTADOR — documento que o contador envia (guia avulsa, certidão,
--              declaração, contrato, recibo...), com arquivo anexado;
--   ONEFLOW  — guia de imposto apurada no OneFlow, que já chegava sozinha e
--              agora ganha protocolo e histórico como qualquer outra.

CREATE SEQUENCE IF NOT EXISTS document_delivery_protocolo_seq;

-- HEXX-<ano>-<número com 6 dígitos>. O número não reinicia a cada ano: o
-- protocolo é único para sempre, e o ano está ali só para leitura.
CREATE OR REPLACE FUNCTION proximo_protocolo() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'HEXX-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '-' ||
         lpad(nextval('document_delivery_protocolo_seq')::text, 6, '0')
$$;

CREATE TABLE IF NOT EXISTS document_delivery (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  protocolo       TEXT NOT NULL UNIQUE DEFAULT proximo_protocolo(),
  origem          TEXT NOT NULL CHECK (origem IN ('CONTADOR', 'ONEFLOW')),
  tipo            TEXT NOT NULL CHECK (tipo IN ('GUIA', 'DECLARACAO', 'CERTIDAO', 'CONTRATO', 'RECIBO', 'OUTRO')),
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  -- O arquivo mora aqui (data URL) quando o contador anexa; para a guia do
  -- OneFlow, o arquivo continua na própria guia (tax_guide.file_url).
  arquivo         TEXT,
  arquivo_nome    TEXT,
  valor           NUMERIC(14, 2),
  vencimento      DATE,
  tax_guide_id    UUID UNIQUE REFERENCES tax_guide(id) ON DELETE CASCADE,
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_por     UUID REFERENCES app_user(id),
  -- Atalhos do histórico, para a lista não precisar agregar eventos.
  visualizado_em  TIMESTAMPTZ,
  confirmado_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS document_delivery_company_idx ON document_delivery(company_id, enviado_em DESC);

CREATE TABLE IF NOT EXISTS document_delivery_event (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  UUID NOT NULL REFERENCES document_delivery(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN (
                 'ENVIADO', 'EMAIL_ENVIADO', 'EMAIL_NAO_ENVIADO',
                 'VISUALIZADO', 'BAIXADO', 'CONFIRMADO', 'ABERTO_PELO_CONTADOR')),
  em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalhe      TEXT
);

CREATE INDEX IF NOT EXISTS document_delivery_event_delivery_idx ON document_delivery_event(delivery_id, em);

ALTER TABLE document_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_delivery_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON document_delivery
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

CREATE POLICY tenant_isolation ON document_delivery_event
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hexxa_app') THEN
    GRANT SELECT, INSERT, UPDATE ON document_delivery, document_delivery_event TO hexxa_app;
    GRANT USAGE ON SEQUENCE document_delivery_protocolo_seq TO hexxa_app;
  END IF;
END $$;

-- As guias oficiais que o cliente já vê ganham protocolo desde já.
INSERT INTO document_delivery (company_id, origem, tipo, titulo, valor, vencimento, tax_guide_id)
SELECT g.company_id, 'ONEFLOW', 'GUIA', g.tax_name, g.amount, g.due_date, g.id
  FROM tax_guide g
 WHERE g.provisional = false
ON CONFLICT (tax_guide_id) DO NOTHING;

INSERT INTO document_delivery_event (delivery_id, company_id, tipo, detalhe)
SELECT d.id, d.company_id, 'ENVIADO', 'Protocolo atribuído a uma guia que já estava disponível.'
  FROM document_delivery d
 WHERE NOT EXISTS (SELECT 1 FROM document_delivery_event e WHERE e.delivery_id = d.id);
