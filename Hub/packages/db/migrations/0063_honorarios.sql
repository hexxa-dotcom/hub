-- Honorários: a tabela de preços do escritório e o desconto por cliente.
--
-- Com movimento: R$ 500,00. Sem movimento: R$ 199,00. Clientes antigos
-- ficam com R$ 100,00 de desconto sobre o plano com movimento (R$ 399,00).
--
-- O desconto mora na ASSINATURA, não num plano à parte: é um acordo com
-- aquele cliente, e a fatura precisa mostrar o preço cheio e o abatimento —
-- quando a tabela subir de novo, o desconto continua sendo de R$ 100 sobre o
-- preço novo, em vez de um plano "antigo" congelado que ninguém lembra de
-- atualizar.

ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE subscription DROP CONSTRAINT IF EXISTS subscription_desconto_valido;
ALTER TABLE subscription ADD CONSTRAINT subscription_desconto_valido CHECK (discount_value >= 0);

INSERT INTO plan (name, monthly_value, features)
SELECT 'Com movimento', 500.00,
       '{"descricao":"Empresa com faturamento, folha ou despesas no mês."}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM plan WHERE name = 'Com movimento');

INSERT INTO plan (name, monthly_value, features)
SELECT 'Sem movimento', 199.00,
       '{"descricao":"Empresa sem faturamento nem movimentação no mês."}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM plan WHERE name = 'Sem movimento');
