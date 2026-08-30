-- Periodicidade de pagamento por contrato (MENSAL | QUINZENAL) — só afeta
-- como o valor a pagar é agrupado/exibido na aba Repasses, não muda como o
-- webhook de faturamento gera os lançamentos.
ALTER TABLE business_contract
  ADD COLUMN IF NOT EXISTS payment_frequency text NOT NULL DEFAULT 'MENSAL';
