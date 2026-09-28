-- Cada execução de rotina do orquestrador: quando, quanto tempo, deu certo,
-- o que devolveu e quantas chamadas do OneFlow gastou. É o que a tela
-- "Integração OneFlow" do escritório lê para mostrar gargalo e falha sem
-- ninguém precisar abrir log. Guarda 60 dias.
CREATE TABLE IF NOT EXISTS rotina_execucao (
  id          bigserial PRIMARY KEY,
  rotina      text NOT NULL,
  turno       text,
  onda        int,
  inicio      timestamptz NOT NULL DEFAULT now(),
  duracao_ms  int,
  status      text NOT NULL CHECK (status IN ('OK', 'FALHOU', 'PULADA')),
  http        int,
  -- Chamadas à API do OneFlow gastas nesta execução (quando dá para medir).
  chamadas    int,
  resumo      jsonb,
  erro        text
);
CREATE INDEX IF NOT EXISTS rotina_execucao_rotina_inicio ON rotina_execucao (rotina, inicio DESC);
-- Só o escritório lê (pela conexão de serviço); nenhum cliente alcança.
ALTER TABLE rotina_execucao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS so_servico ON rotina_execucao;
CREATE POLICY so_servico ON rotina_execucao USING (false);
