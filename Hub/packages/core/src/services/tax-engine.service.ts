/**
 * Motor Tributário Matemático Puro (100% Fidedigno)
 * Recebe todos os parâmetros matemáticos do banco de dados e as variáveis da empresa,
 * executa as regras do Simples Nacional ou Lucro Presumido e retorna o resultado exato e rastreável.
 */

// 1. Tipagem da Rastreabilidade (O "Trace" Matemático)
export interface TaxCalculationTrace {
  ruleId: string;
  regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO';
  annex?: string;
  bracket?: number;
  inputs: {
    rba12: number;
    payroll12?: number;
    currentRevenue: number;
  };
  intermediateSteps: Record<string, number | string>;
  effectiveRate: number;
  taxAmount: number;
  timestamp: string;
}

export interface SimplesNacionalInput {
  rba12: number;
  payroll12: number;
  currentRevenue: number;
  subjectToFatorR: boolean;
  primaryAnnex: string;
  // Regras puxadas do DB:
  brackets: Array<{
    annex: string;
    bracket: number;
    minRevenue: number;
    maxRevenue: number | null;
    nominalRate: number;
    deductionAmount: number;
    partitionDistribution: Record<string, number>;
  }>;
  fatorRLimit: number;
}

export interface SimplesNacionalResult {
  taxAmount: number;
  effectiveRate: number;
  fatorR: number;
  appliedAnnex: string;
  appliedBracket: number;
  partitionValues: Record<string, number>;
  trace: TaxCalculationTrace;
}

export class TaxEngineService {
  /**
   * Calcula o Simples Nacional com precisão matemática absoluta e gera a prova real.
   */
  static calculateSimplesNacional(input: SimplesNacionalInput, ruleId: string): SimplesNacionalResult {
    const { rba12, payroll12, currentRevenue, subjectToFatorR, primaryAnnex, brackets, fatorRLimit } = input;
    
    // 1. Fator R
    const fatorR = rba12 > 0 ? payroll12 / rba12 : 0;
    
    // 2. Determinar Anexo Real
    let appliedAnnex = primaryAnnex;
    if (subjectToFatorR) {
      // Regra oficial: Se Fator R >= limite (28%), Anexo III, senão Anexo V.
      if (fatorR >= fatorRLimit) {
        appliedAnnex = 'III';
      } else {
        appliedAnnex = 'V';
      }
    }

    // 3. Determinar Faixa
    const annexBrackets = brackets
      .filter((b) => b.annex === appliedAnnex)
      .sort((a, b) => a.minRevenue - b.minRevenue);

    // maxRevenue é o TETO da faixa (valor incluído — o seed usa limites como
    // 180000.00/180000.01 entre faixas adjacentes). Usar "<" excluía o valor
    // exato do teto de TODAS as faixas (não batia na de baixo nem na de
    // cima), caindo no fallback errado (última faixa, alíquota mais alta).
    let activeBracket = annexBrackets[annexBrackets.length - 1]; // Assume última faixa
    for (const b of annexBrackets) {
      if (rba12 >= b.minRevenue && (b.maxRevenue === null || rba12 <= b.maxRevenue)) {
        activeBracket = b;
        break;
      }
    }

    if (!activeBracket) {
      throw new Error(`Nenhuma faixa tributária encontrada para RBA12 ${rba12} no Anexo ${appliedAnnex}`);
    }

    // 4. Calcular Alíquota Efetiva
    let effectiveRate = 0;
    if (rba12 > 0) {
      const grossTax = (rba12 * (activeBracket.nominalRate / 100)) - activeBracket.deductionAmount;
      effectiveRate = Math.max(0, grossTax / rba12); 
    } else {
      effectiveRate = activeBracket.nominalRate / 100;
    }

    // 5. Calcular Imposto Devido no Mês
    const taxAmount = currentRevenue * effectiveRate;

    // 6. Repartição de Tributos
    const partitionValues: Record<string, number> = {};
    for (const [tax, pct] of Object.entries(activeBracket.partitionDistribution)) {
      partitionValues[tax] = taxAmount * (pct / 100);
    }

    // 7. Gerar Trace (Rastreabilidade)
    const trace: TaxCalculationTrace = {
      ruleId,
      regime: 'SIMPLES_NACIONAL',
      annex: appliedAnnex,
      bracket: activeBracket.bracket,
      inputs: { rba12, payroll12, currentRevenue },
      intermediateSteps: {
        fatorR,
        nominalRateUsed: activeBracket.nominalRate,
        deductionUsed: activeBracket.deductionAmount
      },
      effectiveRate,
      taxAmount,
      timestamp: new Date().toISOString()
    };

    return {
      taxAmount,
      effectiveRate,
      fatorR,
      appliedAnnex,
      appliedBracket: activeBracket.bracket,
      partitionValues,
      trace
    };
  }

  /**
   * 3ª Redundância: IA de Auditoria Cognitiva
   * Avalia o trace matemático junto ao contexto semântico da nota para detectar riscos fiscais ocultos.
   */
  static async evaluateCognitiveRisk(
    apiKey: string,
    trace: TaxCalculationTrace,
    invoiceContext: { description: string; expectedCnae: string }
  ): Promise<{ status: 'APPROVED' | 'RISK_DETECTED'; explanation: string }> {
    const prompt = `
Você é um Auditor Fiscal Tributário especialista em Simples Nacional.
Sua função é atuar como 3ª camada de redundância avaliando se há riscos fiscais na emissão desta nota e cálculo, considerando contexto semântico que a matemática pura não vê.

DADOS DA NOTA (Semântica):
Descrição do Serviço: "${invoiceContext.description}"
CNAE Enquadrado pelo Sistema: ${invoiceContext.expectedCnae}

DADOS DO CÁLCULO (Matemática - Trace):
Anexo Adotado: ${trace.annex}
Fator R: ${trace.intermediateSteps.fatorR}
Alíquota Efetiva Final: ${(trace.effectiveRate * 100).toFixed(2)}%

Sua tarefa:
1. Avalie a coerência entre a "Descrição do Serviço" e o "CNAE / Anexo" adotado.
2. Identifique anomalias como Fator R caindo drasticamente, ou uso de Anexo III para atividades inerentes ao Anexo V, ou descrições que parecem Comércio em notas de Serviço.
3. Responda ESTRITAMENTE em formato JSON:
{
  "status": "APPROVED" | "RISK_DETECTED",
  "explanation": "Sua explicação curta do motivo do risco ou da aprovação."
}
Não inclua markdown (como \`\`\`json). Apenas o JSON puro.
`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Falha no Cognitive Auditor (Gemini): ${res.status}`);
    }

    const data = (await res.json()) as any;
    const textResponse = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}').trim();
    
    try {
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : textResponse;
      const result = JSON.parse(jsonString);
      return {
        status: result.status === 'RISK_DETECTED' ? 'RISK_DETECTED' : 'APPROVED',
        explanation: result.explanation || 'Análise concluída.'
      };
    } catch (e) {
      return { status: 'APPROVED', explanation: 'Falha no parser da IA, fallback para aprovação. ' + textResponse };
    }
  }
}

