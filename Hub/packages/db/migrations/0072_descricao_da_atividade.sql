-- Como a empresa descreve o que faz, com as palavras dela ("Consultoria em
-- gestão para clínicas") — no lugar do texto formal do CNAE ("Serviços
-- combinados de escritório e apoio administrativo") no cartão e no link.
-- Vazio: vale a descrição do CNAE.
ALTER TABLE company ADD COLUMN IF NOT EXISTS activity_description text;
