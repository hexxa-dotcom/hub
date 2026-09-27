-- O SIMPLES PELO QUE É OFICIAL.
--
-- tax_history.folha_12 / receita_12: a série do Fator R que o OneFlow devolve
-- (folha e receita de cada um dos 12 meses). Antes o Hub guardava só o fator
-- final e estimava a folha multiplicando o salário de hoje por 12 — sem FGTS,
-- sem 13º, e errado para quem contratou há pouco.
--
-- company.simples_anexo / simples_fator_r: o enquadramento que o CONTADOR
-- marcou, para quando ainda não há apuração do OneFlow. A apuração, quando
-- existe, prevalece; sem nenhum dos dois, a tela diz "a confirmar".

ALTER TABLE tax_history ADD COLUMN IF NOT EXISTS folha_12 numeric(14, 2);
ALTER TABLE tax_history ADD COLUMN IF NOT EXISTS receita_12 numeric(14, 2);

ALTER TABLE company ADD COLUMN IF NOT EXISTS simples_anexo text
  CHECK (simples_anexo IS NULL OR simples_anexo IN ('III', 'IV', 'V'));
ALTER TABLE company ADD COLUMN IF NOT EXISTS simples_fator_r text
  CHECK (simples_fator_r IS NULL OR simples_fator_r IN ('SUJEITO', 'NAO_SUJEITO'));
