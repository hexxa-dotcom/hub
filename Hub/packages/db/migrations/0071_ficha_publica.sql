-- Link público da ficha da empresa — o "cartão de visita" que o empresário
-- põe na bio do Instagram, no LinkedIn ou manda no WhatsApp.
--
-- Só dado público (o que o cartão CNPJ já mostra, mais os contatos que a
-- própria empresa cadastrou). Nasce desligado: o empresário liga, e pode
-- desligar a qualquer momento — o link para de abrir na hora.
ALTER TABLE company ADD COLUMN IF NOT EXISTS ficha_publica_slug text;
ALTER TABLE company ADD COLUMN IF NOT EXISTS ficha_publica_ativa boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS company_ficha_publica_slug_key ON company (ficha_publica_slug) WHERE ficha_publica_slug IS NOT NULL;
