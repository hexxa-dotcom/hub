-- A INTELIGÊNCIA DO SISTEMA — o que a Hexx aprendeu e como decidiu.
--
-- Três tabelas, uma por pergunta:
--
-- conhecimento           "o que é isto?" — cada fornecedor, cliente ou
--                        descrição de extrato já identificado, com a conta,
--                        quem ensinou e quantas vezes foi confirmado. É a
--                        base que a IA consulta antes de pensar, e que cresce
--                        a cada resposta. company_id NULL = vale para todas
--                        as empresas (tarifa bancária, imposto, SaaS comum).
--
-- pergunta_de_classificacao
--                        o que nem o conhecimento nem a IA verificada
--                        resolveram vira uma pergunta direta, com opções.
--                        O empresário responde; valor alto também passa pelo
--                        contador.
--
-- registro_da_ia         cada chamada ao modelo: o que entrou, o que saiu e
--                        o que aconteceu depois (aplicado, virou pergunta,
--                        corrigido). É o material para medir e melhorar.

CREATE TABLE IF NOT EXISTS conhecimento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES company(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('CNPJ', 'DESCRICAO')),
  chave          text NOT NULL,           -- CNPJ só dígitos, ou a descrição normalizada
  sentido        text NOT NULL CHECK (sentido IN ('ENTRADA', 'SAIDA')),
  conta_contabil text NOT NULL,           -- código do plano (accounting_code)
  categoria_nome text,
  origem         text NOT NULL CHECK (origem IN ('CONTADOR', 'EMPRESARIO', 'IA_VERIFICADA', 'LANCAMENTO')),
  confirmacoes   integer NOT NULL DEFAULT 1,
  exemplo        text,                    -- uma descrição original, para quem for ler
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, tipo, chave, sentido)
);

CREATE INDEX IF NOT EXISTS conhecimento_busca_idx ON conhecimento (tipo, chave, sentido);

ALTER TABLE conhecimento ENABLE ROW LEVEL SECURITY;

-- Lê o da empresa e o geral; escreve só o da empresa. O geral é curado à parte.
CREATE POLICY conhecimento_leitura ON conhecimento FOR SELECT
  USING (company_id IS NULL OR company_id = app_current_company());
CREATE POLICY conhecimento_escrita ON conhecimento FOR ALL
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

CREATE TABLE IF NOT EXISTS pergunta_de_classificacao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL UNIQUE REFERENCES bank_transaction(id) ON DELETE CASCADE,
  data                date NOT NULL,
  valor               numeric(14, 2) NOT NULL,
  descricao           text NOT NULL,
  -- [{ "conta": "4.1.01", "nome": "Softwares", "motivo": "..." }] — a primeira é a mais provável.
  opcoes              jsonb NOT NULL DEFAULT '[]',
  status              text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'RESPONDIDA')),
  respondida_por      text CHECK (respondida_por IN ('EMPRESARIO', 'CONTADOR', 'CONHECIMENTO')),
  resposta_conta      text,
  respondido_em       timestamptz,
  -- Valor alto: mesmo respondida pelo empresário, o contador confere.
  revisar_contador    boolean NOT NULL DEFAULT false,
  revisado_em         timestamptz,
  criado_em           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pergunta_de_classificacao_aberta_idx
  ON pergunta_de_classificacao (company_id, status);

ALTER TABLE pergunta_de_classificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON pergunta_de_classificacao
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());

CREATE TABLE IF NOT EXISTS registro_da_ia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid REFERENCES company(id) ON DELETE CASCADE,
  tarefa      text NOT NULL,              -- 'CONCILIACAO_CLASSIFICAR', 'CONCILIACAO_REVISAR'…
  modelo      text,
  entrada     jsonb,
  saida       jsonb,
  resultado   jsonb,                      -- o que foi feito com a resposta, item a item
  tokens_in   integer,
  tokens_out  integer,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registro_da_ia_empresa_idx ON registro_da_ia (company_id, criado_em DESC);

ALTER TABLE registro_da_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON registro_da_ia
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
