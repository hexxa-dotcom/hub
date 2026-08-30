export interface ProfitDistributionRequest {
  companyId: string;
  partnerId: string;
  requestedAmount: number;
  companyContext: {
    hasOverdueTaxes: boolean;
    unpaidShareCapital: number;
    allowsDisproportionateDistribution: boolean;
  };
  partnerContext: {
    sharePercentage: number;
    activeMutualContractsBalance: number;
  };
  accountingContext: {
    accumulatedProfit: number;
    accumulatedLosses: number;
    totalProfitDistributedThisYearToPartner: number;
    totalProfitDistributedThisYearGlobally: number;
  };
}

export interface ProfitDistributionResult {
  isApproved: boolean;
  approvedAmount: number;
  blockedAmount: number;
  locks: {
    taxDebts: { passed: boolean; message?: string };
    mutualContracts: { passed: boolean; message?: string };
    realTimeDre: { passed: boolean; message?: string };
    accumulatedLosses: { passed: boolean; message?: string };
    unpaidCapital: { passed: boolean; message?: string };
    disproportionateDistribution: { passed: boolean; message?: string };
  };
}

export class ProfitDistributionService {
  /**
   * Avalia uma solicitação de saque de lucros contra as 6 Travas de Segurança
   * do Motor Tributário e Societário.
   */
  public evaluateDistribution(req: ProfitDistributionRequest): ProfitDistributionResult {
    const result: ProfitDistributionResult = {
      isApproved: true,
      approvedAmount: req.requestedAmount,
      blockedAmount: 0,
      locks: {
        taxDebts: { passed: true },
        mutualContracts: { passed: true },
        realTimeDre: { passed: true },
        accumulatedLosses: { passed: true },
        unpaidCapital: { passed: true },
        disproportionateDistribution: { passed: true },
      },
    };

    // 1. Trava de Débitos (A mais crítica - Lei 8.212/91)
    if (req.companyContext.hasOverdueTaxes) {
      result.locks.taxDebts = {
        passed: false,
        message: 'BLOQUEIO SEVERO: A empresa possui débitos fiscais/previdenciários vencidos. A distribuição de lucros neste cenário gera multa de 50% sobre o valor distribuído (Art. 32 Lei 4.357/64). Regularize os débitos antes de autorizar o saque.',
      };
      return this.rejectEntirely(result);
    }

    // 2. Trava de Mútuo (DDL)
    if (req.partnerContext.activeMutualContractsBalance > 0) {
      result.locks.mutualContracts = {
        passed: false, // We mark as warning/failed but don't strictly block mathematically yet, it's a risk alert.
        message: `ALERTA DE RISCO (DDL): O sócio possui R$ ${req.partnerContext.activeMutualContractsBalance} em contratos de mútuo (empréstimos) ativos com a empresa. Distribuir lucros simultaneamente pode configurar Distribuição Disfarçada de Lucros pela Receita Federal. Recomendamos usar o lucro para quitar o mútuo.`,
      };
      // Em uma regra mais estrita, poderíamos reter o valor para quitar o mútuo. Vamos deixar como alerta forte.
    }

    // 3. Trava de Capital Social Não Integralizado
    // O Código Civil (Art. 1.059) veda a distribuição INTEIRA enquanto o
    // capital social não estiver 100% integralizado — não é uma retenção
    // proporcional ao valor faltante. Reter só uma parte e liberar o resto
    // (como este código fazia antes) contradizia a própria mensagem de
    // bloqueio e aprovava distribuição vedada por lei.
    if (req.companyContext.unpaidShareCapital > 0) {
      result.locks.unpaidCapital = {
        passed: false,
        message: `BLOQUEIO SOCIETÁRIO: Há R$ ${req.companyContext.unpaidShareCapital} de Capital Social a Integralizar. O Código Civil (Art. 1.059) proíbe distribuição de lucros se o capital não estiver totalmente integralizado.`,
      };
      return this.rejectEntirely(result);
    }

    // 4. Trava de Prejuízos Acumulados
    if (req.accountingContext.accumulatedLosses > 0) {
      // O Lucro do período DEVE primeiro cobrir o prejuízo acumulado
      const remainingProfitAfterLosses = req.accountingContext.accumulatedProfit - req.accountingContext.accumulatedLosses;
      
      if (remainingProfitAfterLosses <= 0) {
        result.locks.accumulatedLosses = {
          passed: false,
          message: `BLOQUEIO CONTÁBIL: Todo o lucro do período (R$ ${req.accountingContext.accumulatedProfit}) foi absorvido pelos Prejuízos Acumulados de exercícios anteriores (R$ ${req.accountingContext.accumulatedLosses}). Não há saldo passível de distribuição.`,
        };
        return this.rejectEntirely(result);
      } else {
        result.locks.accumulatedLosses = {
          passed: true,
          message: `INFO: R$ ${req.accountingContext.accumulatedLosses} do lucro gerado foram utilizados para zerar os Prejuízos Acumulados anteriores.`,
        };
        // Atualiza a DRE em tempo real disponível
        req.accountingContext.accumulatedProfit = remainingProfitAfterLosses;
      }
    }

    // 5. Trava de DRE em Tempo Real
    const partnerMaxFairShare = (req.accountingContext.accumulatedProfit * (req.partnerContext.sharePercentage / 100));
    // Subtrai o que o sócio já sacou este ano
    const availableForPartner = partnerMaxFairShare - req.accountingContext.totalProfitDistributedThisYearToPartner;

    if (result.approvedAmount > availableForPartner) {
      result.locks.realTimeDre = {
        passed: false,
        message: `BLOQUEIO DE DRE: O limite contábil real disponível para este sócio neste momento é de R$ ${availableForPartner.toFixed(2)}. Saques excedentes requerem que o valor seja tratado como Pró-labore (sujeito a IR/INSS) ou mútuo.`,
      };
      const excess = result.approvedAmount - availableForPartner;
      result.approvedAmount = Math.max(0, availableForPartner);
      result.blockedAmount += excess;
    }

    // 6. Alerta de Distribuição Desproporcional
    // Se o sócio está pedindo um valor, vamos checar se a distribuição global não quebra a regra societária
    const theoreticalTotalDistribution = req.accountingContext.totalProfitDistributedThisYearGlobally + result.approvedAmount;
    const partnerTheoreticalTotal = req.accountingContext.totalProfitDistributedThisYearToPartner + result.approvedAmount;
    
    if (theoreticalTotalDistribution > 0) {
      const currentProportion = (partnerTheoreticalTotal / theoreticalTotalDistribution) * 100;
      // Tolerância de arredondamento de 0.1%
      if (currentProportion > req.partnerContext.sharePercentage + 0.1) {
        if (!req.companyContext.allowsDisproportionateDistribution) {
          result.locks.disproportionateDistribution = {
            passed: false,
            message: `BLOQUEIO SOCIETÁRIO: Esta transação eleva a fatia de lucros do sócio para ${currentProportion.toFixed(2)}%, acima de suas cotas (${req.partnerContext.sharePercentage}%). O Contrato Social analisado pela IA NÃO prevê cláusula de Distribuição Desproporcional.`,
          };
          return this.rejectEntirely(result);
        } else {
          result.locks.disproportionateDistribution = {
            passed: true,
            message: `INFO: Distribuição Desproporcional detectada e AUTORIZADA com base no Contrato Social validado pela IA.`,
          };
        }
      }
    }

    if (result.blockedAmount > 0) {
      result.isApproved = false; // Parcialmente bloqueado
    }

    return result;
  }

  private rejectEntirely(result: ProfitDistributionResult): ProfitDistributionResult {
    result.isApproved = false;
    result.blockedAmount += result.approvedAmount;
    result.approvedAmount = 0;
    return result;
  }
}
