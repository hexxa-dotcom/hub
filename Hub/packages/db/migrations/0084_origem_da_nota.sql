-- De onde a nota saiu: 'MANUAL' (formulário), 'UM_CLIQUE' (ficha do cliente),
-- 'AGENDADA' (emissão agendada) ou 'CONTRATO' (automática da cobrança).
-- A visualização rápida em Notas mostra isso. NULL = antes deste campo.
ALTER TABLE service_invoice ADD COLUMN IF NOT EXISTS origem text
  CHECK (origem IS NULL OR origem IN ('MANUAL', 'UM_CLIQUE', 'AGENDADA', 'CONTRATO'));
