-- O motor do extrato lança tudo; o que ele lançou sem certeza fica registrado
-- como "respondido pelo MOTOR" e vai para a revisão do contador, sem travar o mês.
ALTER TABLE pergunta_de_classificacao DROP CONSTRAINT IF EXISTS pergunta_de_classificacao_respondida_por_check;
ALTER TABLE pergunta_de_classificacao ADD CONSTRAINT pergunta_de_classificacao_respondida_por_check
  CHECK (respondida_por = ANY (ARRAY['EMPRESARIO', 'CONTADOR', 'CONHECIMENTO', 'MOTOR']));
