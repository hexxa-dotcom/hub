-- Aceite do contrato de prestação de serviços contábeis (Resolução CFC
-- 1.590/2020) e dos Termos de Uso, feito dentro do Hub.
--
-- Cada linha é a PROVA de um aceite: quem, quando, de onde, quais versões e o
-- texto exato do Termo de Adesão que a pessoa viu (com o hash dele). Nunca se
-- altera nem se apaga — texto ou valor novo gera um aceite novo.
CREATE TABLE IF NOT EXISTS aceite_de_contrato (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  versao_contrato   text NOT NULL,
  versao_termos     text NOT NULL,
  texto_da_adesao   text NOT NULL,
  hash_da_adesao    text NOT NULL,
  hash_do_contrato  text NOT NULL,
  hash_dos_termos   text NOT NULL,
  aceito_por_id     text,
  aceito_por_nome   text,
  aceito_por_email  text,
  ip                text,
  navegador         text,
  aceito_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aceite_de_contrato_empresa ON aceite_de_contrato (company_id, aceito_em DESC);
