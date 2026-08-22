/**
 * Regras de linguagem do Hexx Hub Digital — FONTE ÚNICA DE VERDADE.
 *
 * CRÍTICO (definido pelo produto):
 *   1. NUNCA "investimento" para preços/honorários  → use "valor".
 *   2. NUNCA "competência" para períodos            → use "mês".
 *
 * A UI (apps/web) e o servidor MCP (apps/mcp) devem importar os labels daqui,
 * nunca escrever as strings soltas. Assim a regra é garantida em um só lugar.
 */

/** Termos proibidos -> substituto correto. Usado por `assertCommercialCopy`. */
export const FORBIDDEN_TERMS: Record<string, string> = {
  investimento: 'valor',
  investimentos: 'valores',
  competência: 'mês',
  competencia: 'mês',
};

/** Labels canônicos reutilizados na UI e no MCP. */
export const LABELS = {
  // valores (NUNCA "investimento")
  price: 'Valor',
  monthlyPrice: 'Valor mensal',
  contractPrice: 'Valor do contrato',
  fee: 'Valor dos honorários',
  // períodos (NUNCA "competência")
  period: 'Mês',
  referenceMonth: 'Mês de referência',
  // dashboard
  monthlyRevenue: 'Faturamento do Mês',
  estimatedTax: 'Imposto no Mês Que Vem',
  monthlyExpenses: 'Despesas do Mês',
  taxThermometer: 'Quanto Pago de Imposto',
  netProfit: 'O Que Sobra no Bolso',
  urgentNotices: 'Caixa Postal & Recados',
  copyPix: 'Copiar Pix',
} as const;

/**
 * Valida que um texto comercial não contém jargão proibido.
 * Use em testes/CI e em revisões de copy. Lança erro com a correção sugerida.
 */
export function assertCommercialCopy(text: string): void {
  const lower = text.toLowerCase();
  for (const [bad, good] of Object.entries(FORBIDDEN_TERMS)) {
    if (lower.includes(bad)) {
      throw new Error(
        `Linguagem proibida: "${bad}" encontrado. Use "${good}" em vez disso. Texto: "${text}"`,
      );
    }
  }
}
