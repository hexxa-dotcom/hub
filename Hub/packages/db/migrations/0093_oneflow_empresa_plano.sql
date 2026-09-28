-- Qual modelo de plano de contas a empresa usa no OneFlow: decide o de-para
-- (Dinâmico, 192 contas; ou Padrão, 766). NULL = sem plano lá (0 contas).
ALTER TABLE oneflow_empresa ADD COLUMN IF NOT EXISTS plano_modelo text;
ALTER TABLE oneflow_empresa ADD COLUMN IF NOT EXISTS plano_conferido_em timestamptz;
