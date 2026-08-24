-- "Arquivos Permanentes" virou "Documentos da Empresa" (movido para
-- Contabilidade). Adiciona categorias CNPJ e SOCIOS ao CHECK de category.
ALTER TABLE company_document DROP CONSTRAINT IF EXISTS company_document_category_check;
ALTER TABLE company_document ADD CONSTRAINT company_document_category_check
  CHECK (category IN ('ALVARA', 'CONTRATO', 'CND', 'CNPJ', 'SOCIOS', 'OUTRO'));
