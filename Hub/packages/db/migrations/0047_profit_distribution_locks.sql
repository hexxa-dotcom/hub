-- Motor real de distribuição de lucros: liga o ProfitDistributionService (6 travas
-- legais) ao invés das telas de Sócios/Patrimonial persistirem sem validação.

ALTER TABLE "profit_distribution" ADD COLUMN "partner_id" uuid REFERENCES "partner"("id") ON DELETE SET NULL;

ALTER TABLE "company" ADD COLUMN "unpaid_share_capital" numeric(14, 2) NOT NULL DEFAULT '0';
ALTER TABLE "company" ADD COLUMN "allows_disproportionate_distribution" boolean NOT NULL DEFAULT false;

ALTER TABLE "partner" ADD COLUMN "mutual_loan_balance" numeric(14, 2) NOT NULL DEFAULT '0';

-- partner_distribution (Painel de Rentabilidade do Sócio) nunca teve consumidor
-- real (zero linhas, zero código lendo/escrevendo) — profit_distribution com
-- partner_id agora cobre o mesmo papel com histórico de verdade.
DROP TABLE IF EXISTS "partner_distribution";
