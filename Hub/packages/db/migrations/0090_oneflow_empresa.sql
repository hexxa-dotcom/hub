-- O que o OneFlow diz de cada empresa e quase nunca muda — guardado para não
-- gastar cota perguntando toda noite. Hoje: desde quando o contábil existe lá.
CREATE TABLE IF NOT EXISTS oneflow_empresa (
  company_id      uuid PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  -- 'AAAA-MM' (como o OneFlow devolve); NULL = contábil não implantado lá.
  inicio_contabil text,
  conferido_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE oneflow_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS so_servico ON oneflow_empresa;
CREATE POLICY so_servico ON oneflow_empresa USING (false);
