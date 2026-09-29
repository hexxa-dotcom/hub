-- Atividade principal (CNAE) de cada CNPJ que aparece nos extratos, lida do
-- cartão do CNPJ uma vez e reaproveitada por todos os clientes. É a base da
-- regra "CNAE da outra parte → conta de despesa".
CREATE TABLE IF NOT EXISTS cnae_do_cnpj (
  cnpj          text PRIMARY KEY,
  cnae          text,
  descricao     text,
  razao_social  text,
  consultado_em timestamptz NOT NULL DEFAULT now()
);
