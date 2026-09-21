-- A ficha da empresa: o que a consulta do CNPJ já traz e se perdia.
--
-- A Receita devolve capital social, data de abertura e atividade principal a
-- cada consulta, e o Hub descartava os três. Eram justamente os dados que o
-- empresário reconhece como "a minha empresa" — e sem eles a tela de cadastro
-- só teria nome, CNPJ e endereço, que é o que ele já sabe de cor.
--
-- Guardar também evita reconsultar: a API é paga por consulta, e capital
-- social não muda toda semana.
ALTER TABLE company ADD COLUMN IF NOT EXISTS share_capital numeric(14, 2);
ALTER TABLE company ADD COLUMN IF NOT EXISTS founded_at date;
ALTER TABLE company ADD COLUMN IF NOT EXISTS main_activity_code text;
ALTER TABLE company ADD COLUMN IF NOT EXISTS main_activity_text text;

COMMENT ON COLUMN company.founded_at IS
  'Data de abertura na Receita. Base do "tempo de atividade" na ficha da empresa.';
