-- Periodicidade de distribuição de lucros escolhida pela empresa (mensal,
-- trimestral, semestral, anual) — usada em Sócios > Distribuição pra sugerir
-- a próxima data e não deixar o lucro acumulado esquecido no caixa.
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "profit_distribution_frequency" text NOT NULL DEFAULT 'MENSAL';
