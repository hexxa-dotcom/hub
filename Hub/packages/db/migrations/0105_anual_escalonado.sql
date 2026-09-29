-- Anual escalonado (Filipe, 29/09/2026): desconto maior na entrada, menor nos
-- planos altos. Simples 449 (10%), Presumido 649 (7%) — economia de R$ 600/ano
-- nos três planos com movimento. Essencial 169 e Light 249 continuam.
UPDATE plan SET features = features || '{"valorAnualMensal": 449}'::jsonb
  || jsonb_build_object('recursos', (SELECT jsonb_agg(CASE WHEN r = 'R$ 419/mês na assinatura anual' THEN 'R$ 449/mês na assinatura anual' ELSE r END) FROM jsonb_array_elements_text(features->'recursos') r))
 WHERE name = 'Com movimento';
UPDATE plan SET features = features || '{"valorAnualMensal": 649}'::jsonb
  || jsonb_build_object('recursos', (SELECT jsonb_agg(CASE WHEN r = 'R$ 589/mês na assinatura anual' THEN 'R$ 649/mês na assinatura anual' ELSE r END) FROM jsonb_array_elements_text(features->'recursos') r))
 WHERE name = 'Lucro Presumido';
