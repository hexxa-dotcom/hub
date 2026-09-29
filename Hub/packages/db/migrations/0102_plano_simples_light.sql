-- Plano Simples Light: empresa do Simples começando (Filipe, 29/09/2026).
-- R$ 299/mês (R$ 249/mês no anual), até 10 notas e R$ 10 mil/mês, 1 sócio;
-- sem colaboradores, contratos, propostas, bens e relatórios avançados.
ALTER TABLE company ADD COLUMN IF NOT EXISTS notas_extras_mes text; -- 'AAAA-MM' liberado pelo contador

INSERT INTO plan (name, monthly_value, features)
SELECT 'Simples Light', 299.00, '{
  "cor": "neutro",
  "ativo": true,
  "nomeComercial": "Simples Light",
  "descricao": "Para quem está começando no Simples: o essencial da contabilidade e das notas, com preço de início.",
  "recursos": [
    "Até 10 notas fiscais por mês",
    "Faturamento de até R$ 10 mil por mês",
    "Contabilidade e obrigações em dia",
    "Pró-labore de 1 sócio",
    "R$ 249/mês na assinatura anual"
  ],
  "sociosInclusos": 1,
  "adicionalPorColaborador": 50,
  "adicionalPorEvento": 150,
  "valorAnualMensal": 249,
  "limiteNotasMes": 10,
  "limiteFaturamentoMes": 10000,
  "modulosBloqueados": ["contratos", "propostas", "colaboradores", "patrimonial", "relatorios-avancados"]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM plan WHERE name = 'Simples Light');
