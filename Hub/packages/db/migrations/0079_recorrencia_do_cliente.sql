-- Recorrência do cliente, marcada à mão. NULL = o sistema identifica pelas
-- notas (nota em 3 dos últimos 4 meses, ou contrato ativo = recorrente).
-- Marcado, o que o empresário escolheu vale sobre a regra.
ALTER TABLE customer ADD COLUMN IF NOT EXISTS recorrencia text
  CHECK (recorrencia IS NULL OR recorrencia IN ('RECORRENTE', 'AVULSO'));
