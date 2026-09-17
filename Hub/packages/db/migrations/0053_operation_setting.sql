-- CONFIGURAÇÃO DE OPERAÇÃO — três camadas, guardando só as exceções.
--
-- Uma linha por escopo, e cada linha guarda APENAS o que sobrescreve. Se a
-- linha da empresa copiasse a configuração inteira no cadastro, melhorar o
-- padrão amanhã não chegaria a nenhuma empresa já cadastrada: cada ajuste
-- viraria migração em N linhas, e em um ano ninguém saberia qual empresa está
-- com qual versão.
--
-- Guardando só o delta: empresa nova herda tudo e nasce funcionando, o
-- contador só toca no que é exceção, e melhorar o padrão melhora todo mundo
-- que não sobrescreveu.

CREATE TABLE IF NOT EXISTS operation_setting (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'SYSTEM' (scope_key nulo) | 'PROFILE' (SERVICE|HOLDING) | 'COMPANY' (uuid)
  scope       TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'PROFILE', 'COMPANY')),
  scope_key   TEXT,
  -- Sobrescrita PARCIAL, no formato de SettingsParcial (@hexxa/core).
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- O escopo SYSTEM é único e não tem chave; os outros dois exigem chave.
  CONSTRAINT ck_operation_setting_key CHECK (
    (scope = 'SYSTEM' AND scope_key IS NULL) OR
    (scope <> 'SYSTEM' AND scope_key IS NOT NULL)
  )
);

-- Uma linha por escopo. Duas linhas de COMPANY para a mesma empresa deixariam
-- a resolução dependendo da ordem de leitura — silenciosamente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operation_setting_system
  ON operation_setting (scope) WHERE scope = 'SYSTEM';
CREATE UNIQUE INDEX IF NOT EXISTS uq_operation_setting_scoped
  ON operation_setting (scope, scope_key) WHERE scope_key IS NOT NULL;

-- RLS: a linha da empresa é do tenant; SYSTEM e PROFILE são da plataforma e
-- só o contador (conexão admin) enxerga.
ALTER TABLE operation_setting ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON operation_setting;
CREATE POLICY tenant_isolation ON operation_setting
  USING (scope <> 'COMPANY' OR scope_key = app_current_company()::text)
  WITH CHECK (scope = 'COMPANY' AND scope_key = app_current_company()::text);
