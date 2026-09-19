-- Autorização de envio ao OneFlow, por mês.
--
-- O envio era contínuo e não olhava o fechamento: mandava o mês corrente,
-- ainda aberto, e mandou parcelas futuras (out/2026 a jan/2027) para os
-- livros oficiais. Lançamento que entra lá só sai por exclusão manual.
--
-- Liberar (stage = CONFERIDO) é o contador dizer que o mês está certo.
-- Autorizar o envio é dizer que ele pode sair. Podem ser o mesmo clique —
-- `ConfigFechamento.envioAutomaticoAoLiberar` — ou dois, e é por isso que são
-- colunas separadas.

ALTER TABLE monthly_closure
  ADD COLUMN IF NOT EXISTS send_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_authorized_by_user_id uuid;

COMMENT ON COLUMN monthly_closure.send_authorized_at IS
  'Quando o envio deste mês ao OneFlow foi autorizado. Nulo = nada deste mês sai.';

-- O envio procura, por empresa, os meses autorizados.
CREATE INDEX IF NOT EXISTS monthly_closure_envio_idx
  ON monthly_closure (company_id, reference_month)
  WHERE send_authorized_at IS NOT NULL;
