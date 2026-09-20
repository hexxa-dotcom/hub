-- Cliente encerrado.
--
-- Não existia. Cada cron decidia sozinho quem varrer, e metade deles varria
-- todo mundo: um cliente que saiu continuaria tendo despesas fixas lançadas
-- todo mês, contratos faturados, a conta sincronizada com o Nibo e o mês
-- fechado pelo agente. Desligar os agentes um a um não alcançava esses.
--
-- Encerrar não apaga nada — o histórico contábil é guardado por lei e pode
-- ser pedido anos depois. Só tira a empresa da operação. Reativar é limpar a
-- data.
ALTER TABLE company
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text;

COMMENT ON COLUMN company.closed_at IS
  'Cliente encerrado: nenhum cron opera sobre a empresa. Dados preservados.';
