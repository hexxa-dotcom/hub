-- O faturamento que o cliente DECLARA no primeiro acesso.
--
-- Quem acabou de entrar não tem histórico de notas no Hub, e sem RBT12 o
-- termômetro tributário, a faixa do Simples e o aviso de teto ficam todos
-- mudos — justo no dia em que a pessoa está decidindo se o produto serve.
--
-- É declaração, não escrituração: não vira partida no razão, porque receita
-- sem nota não é faturamento tributável (ver a regra da receita). Serve de
-- ponto de partida até existir histórico próprio, e por isso guarda também
-- QUANDO foi declarado — um número de doze meses envelhece.
--
-- Não reaproveita `revenue_ceiling`: aquele campo é o teto do regime, outra
-- coisa, e empilhar dois sentidos na mesma coluna é como se perde o
-- significado de um cadastro.
ALTER TABLE company ADD COLUMN IF NOT EXISTS declared_revenue_12m numeric(14, 2);
ALTER TABLE company ADD COLUMN IF NOT EXISTS declared_revenue_at date;

COMMENT ON COLUMN company.declared_revenue_12m IS
  'Faturamento dos últimos 12 meses informado pelo cliente no primeiro acesso. Declaração, não escrituração.';
