-- Departamento Pessoal (minha-contabilidade/departamento-pessoal) era 100%
-- mockado no front (seedColaboradores). A tabela `employee` já existia e já
-- alimentava o Fator R (getSimplesInputs), mas faltavam campos reais que a
-- UI precisa pra virar um cadastro de verdade.
ALTER TABLE employee ADD COLUMN IF NOT EXISTS vinculo TEXT NOT NULL DEFAULT 'CLT' CHECK (vinculo IN ('CLT', 'PJ', 'Socio', 'Estagiario'));
ALTER TABLE employee ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS email TEXT;
