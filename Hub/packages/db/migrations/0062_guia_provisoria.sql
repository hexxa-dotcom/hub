-- Guia provisória: o DAS estimado no fechamento, antes da apuração oficial.
--
-- O mês precisa reconhecer o imposto no próprio mês, e o DAS oficial só sai
-- do OneFlow entre os dias 1 e 15 do mês seguinte. Por isso o fechamento
-- provisiona — e a provisão é certa no razão.
--
-- Mas ela aparecia ao cliente como uma guia qualquer, com valor e status
-- "pendente". É estimativa: o oficial pode diferir, e o cliente pagaria o
-- número errado. A marca separa as duas coisas — no razão a provisão fica; na
-- tela do cliente, só a guia oficial aparece. Quando a apuração chega, a
-- volta do OneFlow substitui o valor e desliga a marca.

ALTER TABLE tax_guide
  ADD COLUMN IF NOT EXISTS provisional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tax_guide.provisional IS
  'true = estimativa do fechamento, aguardando a apuração oficial. Nunca mostrada ao cliente como cobrança.';
