-- Por que um resultado oficial foi recusado.
--
-- O espelho confere o plano de contas antes de somar: o plano é por empresa
-- no OneFlow, e um grupo de Patrimônio Líquido lido como resultado poria o
-- capital social dentro do lucro distribuível. Quando a conferência falha, o
-- resultado fica nulo — e o motivo fica aqui, para o contador ver o que não
-- bateu em vez de só "indisponível".
ALTER TABLE oneflow_resultado ADD COLUMN IF NOT EXISTS motivo text;
