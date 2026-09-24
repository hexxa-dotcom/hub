-- Documentos da Empresa: o arquivo sobe junto (antes era só um link colado)
-- e as categorias passam a dizer QUAL documento é — é o que permite montar o
-- checklist (contrato social, alvará, cada certidão com a sua validade).
ALTER TABLE company_document ADD COLUMN IF NOT EXISTS file_data text;   -- data URL do arquivo
ALTER TABLE company_document ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE company_document DROP CONSTRAINT IF EXISTS company_document_category_check;
ALTER TABLE company_document ADD CONSTRAINT company_document_category_check CHECK (category IN (
  'CONTRATO_SOCIAL', 'CNPJ', 'ALVARA', 'CND_FEDERAL', 'CND_ESTADUAL', 'CND_MUNICIPAL', 'CRF_FGTS',
  'SOCIOS', 'CONTRATO', 'CND', 'OUTRO'
));
