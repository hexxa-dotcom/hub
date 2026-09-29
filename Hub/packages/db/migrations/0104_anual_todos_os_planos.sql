-- Anual no cartão para todos os planos (Filipe, 29/09/2026), ~15–17% abaixo do mensal.
UPDATE plan SET features = features || '{"valorAnualMensal": 169}'::jsonb WHERE name = 'Sem movimento';
UPDATE plan SET features = features || '{"valorAnualMensal": 419}'::jsonb WHERE name = 'Com movimento';
UPDATE plan SET features = features || '{"valorAnualMensal": 589}'::jsonb WHERE name = 'Lucro Presumido';
-- Cliente com valor combinado ou desconto: anual = 15% sobre o que ele já paga (ver asaas-plataforma.ts).
UPDATE plan SET features = jsonb_set(features, '{recursos}', (features->'recursos') || '"R$ 169/mês na assinatura anual"'::jsonb) WHERE name = 'Sem movimento' AND NOT (features->'recursos') @> '["R$ 169/mês na assinatura anual"]';
UPDATE plan SET features = jsonb_set(features, '{recursos}', (features->'recursos') || '"R$ 419/mês na assinatura anual"'::jsonb) WHERE name = 'Com movimento' AND NOT (features->'recursos') @> '["R$ 419/mês na assinatura anual"]';
UPDATE plan SET features = jsonb_set(features, '{recursos}', (features->'recursos') || '"R$ 589/mês na assinatura anual"'::jsonb) WHERE name = 'Lucro Presumido' AND NOT (features->'recursos') @> '["R$ 589/mês na assinatura anual"]';
