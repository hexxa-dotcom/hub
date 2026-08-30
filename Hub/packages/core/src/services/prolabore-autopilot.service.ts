export interface ProlaboreAutopilotInput {
  /** Faturamento acumulado nos últimos 12 meses (RBT12) */
  rbt12: number;
  /** Folha acumulada dos últimos 11 meses (sem contar o mês atual que será calculado) */
  payrollLast11Months: number;
  /**
   * Salário mínimo vigente no país. SEMPRE informe explicitamente — o
   * default interno é só um fallback de emergência e fica desatualizado a
   * cada reajuste anual (ver getCurrentMinimumWage() em lib/server/fiscal.ts,
   * que lê de tax_regime_setting).
   */
  minimumWage?: number;
  /** Faturamento projetado/estimado para o próprio mês atual (opcional, para ajustes mais precisos) */
  currentMonthRevenue?: number;
}

export interface ProlaboreAutopilotResult {
  /** O valor ideal matemático calculado para o Pró-labore deste mês */
  idealProlabore: number;
  /** Fator R projetado se pagar esse valor ideal */
  projectedFatorR: number;
  /** True se a empresa foi blindada e caiu no Anexo III (<= 6% inicial) */
  isSafeAnexoIII: boolean;
  /** Motivo da decisão (ex: "Ajuste para Fator R" ou "Piso do Salário Mínimo") */
  reasoning: string;
}

export class ProlaboreAutopilotService {
  /** 
   * Constante para o alvo do Fator R. 
   * Usamos 28.01% para garantir uma margem de segurança milimétrica acima dos 28%. 
   */
  private static TARGET_FATOR_R = 0.2801;

  public calculateIdealProlabore(input: ProlaboreAutopilotInput): ProlaboreAutopilotResult {
    // Fallback de emergência (2026: R$ 1.621,00, Decreto 12.797/2025) — só
    // usado se o chamador não informar minimumWage explicitamente.
    const minWage = input.minimumWage || 1621.0;
    
    if (input.rbt12 <= 0) {
      return {
        idealProlabore: minWage,
        projectedFatorR: 1, // Folha infinita relativa a receita 0
        isSafeAnexoIII: true,
        reasoning: 'Faturamento zerado. Pró-labore definido para o piso legal de 1 Salário Mínimo.'
      };
    }

    // Fórmula do Fator R: (Folha11 + FolhaMesAtual) / RBT12 >= 0.28
    // Isolando a FolhaMesAtual (Pró-labore ideal):
    const targetPayroll12 = input.rbt12 * ProlaboreAutopilotService.TARGET_FATOR_R;
    const requiredCurrentProlabore = targetPayroll12 - input.payrollLast11Months;

    let finalProlabore = requiredCurrentProlabore;
    let reasoning = '';

    if (finalProlabore <= 0) {
      // Já tem folha acumulada suficiente para blindar o mês sem pagar nada, 
      // mas a lei exige retirada de quem trabalha, logo aplicamos o salário mínimo.
      finalProlabore = minWage;
      reasoning = 'A folha acumulada já garante o Fator R de 28%. Pró-labore fixado no piso legal (Salário Mínimo).';
    } else if (finalProlabore < minWage) {
      finalProlabore = minWage;
      reasoning = 'O cálculo do Fator R exigiria menos que o piso legal. Pró-labore fixado no piso legal (Salário Mínimo).';
    } else {
      // Arredonda para 2 casas decimais para evitar dízimas (ex: 2500.51)
      finalProlabore = Math.ceil(finalProlabore * 100) / 100;
      reasoning = `Pró-labore calculado cirurgicamente para atingir ${ProlaboreAutopilotService.TARGET_FATOR_R * 100}% do RBT12 e ativar o Anexo III.`;
    }

    const projectedFatorR = (input.payrollLast11Months + finalProlabore) / input.rbt12;

    return {
      idealProlabore: finalProlabore,
      projectedFatorR: projectedFatorR,
      isSafeAnexoIII: projectedFatorR >= 0.28,
      reasoning: reasoning
    };
  }
}
