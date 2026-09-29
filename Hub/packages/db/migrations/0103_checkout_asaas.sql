-- Checkout da fatura de honorários pelo Asaas da plataforma (29/09/2026):
-- boleto/Pix pelo valor cheio, cartão com desconto, e o ano inteiro no cartão.
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS asaas_payment_id text;      -- boleto (com Pix)
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS asaas_invoice_url text;
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS asaas_boleto_url text;
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS asaas_card_payment_id text; -- cartão, criado sob demanda
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS asaas_card_url text;
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE accounting_invoice ADD COLUMN IF NOT EXISTS paid_with text;             -- BOLETO | PIX | CARTAO | ANUAL

ALTER TABLE subscription ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'MENSAL'; -- MENSAL | ANUAL
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS paid_until date;                  -- anual pago cobre até aqui
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS asaas_annual_payment_id text;
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS asaas_annual_url text;

ALTER TABLE platform_asaas_config ADD COLUMN IF NOT EXISTS card_discount_percent numeric(5,2) NOT NULL DEFAULT 5;
