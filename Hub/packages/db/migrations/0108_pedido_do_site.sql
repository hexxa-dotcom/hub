-- Contratação pelo site (checkout de hexxdigital.com.br). Cada pedido guarda
-- o que a pessoa escolheu, o aceite dos termos e a cobrança no Asaas; o
-- webhook marca o pagamento (externalReference `pedido:<id>`). Cartão é
-- sempre na página do Asaas — o número nunca passa pelo Hub.
CREATE TABLE IF NOT EXISTS pedido_do_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano text NOT NULL,              -- id do site: mei, sem-movimento, simples-light, simples-completo, presumido
  plan_id uuid REFERENCES plan(id),
  cobranca text NOT NULL CHECK (cobranca IN ('anual', 'mensal')),
  metodo text NOT NULL CHECK (metodo IN ('pix', 'boleto', 'cartao')),
  tem_cnpj boolean NOT NULL,
  cnpj text,
  razao_social text,
  nome text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  valor numeric(12,2) NOT NULL,     -- por parcela/mês
  parcelas int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'AGUARDANDO' CHECK (status IN ('AGUARDANDO', 'PAGO', 'SEM_COBRANCA', 'CANCELADO')),
  asaas_customer_id text,
  asaas_payment_id text,
  asaas_invoice_url text,
  asaas_boleto_url text,
  pix_payload text,
  pix_imagem text,
  aceite_versao text NOT NULL,
  aceite_em timestamptz NOT NULL DEFAULT now(),
  aceite_ip text,
  company_id uuid REFERENCES company(id),
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_do_site_status_idx ON pedido_do_site (status, created_at DESC);
