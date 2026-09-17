-- CADEIA DE TOKENS DO ONEFLOW.
--
-- A autenticação do OneFlow tem três níveis, e cada um expira em 24 horas:
--
--   token do usuário  →  token do app (escritório)  →  token da empresa
--
-- O que existia antes guardava UM token estático por empresa, colado à mão na
-- ficha do cliente. Isso funciona por um dia e para em silêncio no segundo —
-- o pior modo de falha possível numa integração contábil, porque ninguém
-- percebe até o fechamento não sair.
--
-- Esta tabela guarda a cadeia inteira, com refresh_token e validade, para que
-- a renovação seja automática. Uma linha por nível.

CREATE TABLE IF NOT EXISTS oneflow_token (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'USER' (escopo da conta), 'APP' (escritório), 'COMPANY' (uma empresa)
  scope        TEXT NOT NULL CHECK (scope IN ('USER', 'APP', 'COMPANY')),
  -- Null em USER; app_hash em APP; id da empresa no Hub em COMPANY.
  scope_key    TEXT,
  /** `app_hash` do OneFlow — é por ele que se pede um token novo. */
  app_hash     TEXT,
  token_enc    TEXT NOT NULL,
  refresh_enc  TEXT,
  /**
   * Quando o token expira. Renovamos ANTES de usar quando falta pouco, em vez
   * de esperar o 401: um 401 no meio de um lote de lançamentos deixaria metade
   * enviada e metade não.
   */
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_oneflow_token_key CHECK (
    (scope = 'USER' AND scope_key IS NULL) OR
    (scope <> 'USER' AND scope_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_oneflow_token_user
  ON oneflow_token (scope) WHERE scope = 'USER';
CREATE UNIQUE INDEX IF NOT EXISTS uq_oneflow_token_scoped
  ON oneflow_token (scope, scope_key) WHERE scope_key IS NOT NULL;

-- Registro do que já foi enviado ao OneFlow, para não lançar duas vezes lá.
--
-- O razão tem idempotência do lado de cá, mas isso não diz nada sobre o que
-- chegou do lado de lá. Reenviar um lote depois de uma falha de rede
-- duplicaria lançamento na contabilidade oficial — o tipo de erro que só
-- aparece no balanço.
CREATE TABLE IF NOT EXISTS oneflow_envio (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  journal_entry_id  UUID NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
  /** Id que o OneFlow devolveu, para conseguir excluir lá se precisar. */
  oneflow_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'ENVIADO',
  erro              TEXT,
  enviado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma partida só vai uma vez. É esta restrição que torna seguro reexecutar um
-- envio interrompido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oneflow_envio_partida
  ON oneflow_envio (journal_entry_id) WHERE status = 'ENVIADO';
CREATE INDEX IF NOT EXISTS idx_oneflow_envio_company
  ON oneflow_envio (company_id, enviado_em DESC);

ALTER TABLE oneflow_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE oneflow_envio ENABLE ROW LEVEL SECURITY;

-- Tokens são da plataforma, não do tenant: nenhuma policy de empresa os
-- alcança, e só a conexão admin (contador) os lê.
DROP POLICY IF EXISTS sem_acesso_tenant ON oneflow_token;
CREATE POLICY sem_acesso_tenant ON oneflow_token USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS tenant_isolation ON oneflow_envio;
CREATE POLICY tenant_isolation ON oneflow_envio
  USING (company_id = app_current_company())
  WITH CHECK (company_id = app_current_company());
