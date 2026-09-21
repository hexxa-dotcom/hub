-- Honorários combinados caso a caso.
--
-- Até aqui o preço de um cliente era sempre "plano menos desconto". Isso serve
-- enquanto o acordo é um abatimento sobre a tabela — e foi escrito assim de
-- propósito, para que um reajuste da tabela chegue a todo mundo sem alguém
-- precisar lembrar de recalcular cliente por cliente.
--
-- Mas há cliente cujo honorário não é tabela nenhuma: é um valor combinado, que
-- não sobe quando a tabela sobe. Fingir que esse valor é "R$ 500 menos R$ 137"
-- inventa um desconto que não existe e imprime isso na fatura do cliente.
--
-- Então o valor combinado passa a ser explícito. Quando `custom_value` está
-- preenchido, ele É o preço: a tabela e o desconto não entram na conta.
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS custom_value numeric(14, 2);

COMMENT ON COLUMN subscription.custom_value IS
  'Honorário combinado com este cliente. Quando preenchido, substitui plan.monthly_value e ignora discount_value.';

-- O plano que carrega esses acordos. Preço 0 na tabela porque o preço não é
-- dele: é de cada assinatura.
INSERT INTO plan (name, monthly_value, features)
SELECT 'Personalizado', 0, '{"descricao":"Honorário combinado caso a caso — o valor fica na assinatura do cliente, não na tabela."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM plan WHERE name = 'Personalizado');
