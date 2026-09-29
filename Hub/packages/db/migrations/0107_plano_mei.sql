-- Escada de planos do site (Filipe, 29/09/2026): MEI entra no Essencial,
-- Simples vira "Simples Completo" ao lado do Light.
INSERT INTO plan (name, monthly_value, features)
SELECT 'MEI', 99.00, '{"cor":"neutro","ativo":true,"nomeComercial":"MEI","descricao":"Para o microempreendedor individual.","recursos":["DAS-MEI e declaração anual (DASN-SIMEI) em dia","Notas fiscais pelo Hub","Aviso antes de estourar o limite do MEI, e a migração para o Simples com a gente","Empregado do MEI: R$ 50/mês","R$ 79/mês na assinatura anual"],"valorAnualMensal":79,"sociosInclusos":1,"adicionalPorColaborador":50,"adicionalPorEvento":150}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM plan WHERE name = 'MEI');
UPDATE plan SET features = features || '{"nomeComercial":"Simples Completo"}'::jsonb WHERE name = 'Com movimento';
