import { describe, it, expect } from 'vitest';
import { ProfitDistributionService, type ProfitDistributionRequest } from './profit-distribution.service';

function baseRequest(overrides: Partial<ProfitDistributionRequest> = {}): ProfitDistributionRequest {
  return {
    companyId: 'c1',
    partnerId: 'p1',
    requestedAmount: 50000,
    companyContext: {
      hasOverdueTaxes: false,
      unpaidShareCapital: 0,
      allowsDisproportionateDistribution: false,
    },
    partnerContext: {
      sharePercentage: 50,
      activeMutualContractsBalance: 0,
    },
    accountingContext: {
      accumulatedProfit: 200000,
      accumulatedLosses: 0,
      totalProfitDistributedThisYearToPartner: 0,
      totalProfitDistributedThisYearGlobally: 0,
    },
    ...overrides,
  };
}

describe('ProfitDistributionService — capital social não integralizado', () => {
  it('bloqueia a distribuição INTEIRA mesmo quando o capital faltante é pequeno frente ao valor pedido', () => {
    const svc = new ProfitDistributionService();
    const req = baseRequest({
      requestedAmount: 50000,
      companyContext: { hasOverdueTaxes: false, unpaidShareCapital: 100, allowsDisproportionateDistribution: false },
    });
    const result = svc.evaluateDistribution(req);

    // Antes do fix: approvedAmount = 49900 (retinha só os 100 faltantes).
    // Lei exige bloqueio total enquanto capital não integralizado.
    expect(result.approvedAmount).toBe(0);
    expect(result.blockedAmount).toBe(50000);
    expect(result.isApproved).toBe(false);
    expect(result.locks.unpaidCapital.passed).toBe(false);
  });

  it('libera normalmente quando o capital está integralizado', () => {
    const svc = new ProfitDistributionService();
    // sharePercentage 100 (sócio único) evita a trava não-relacionada de
    // distribuição desproporcional interferir neste teste.
    const req = baseRequest({
      requestedAmount: 10000,
      companyContext: { hasOverdueTaxes: false, unpaidShareCapital: 0, allowsDisproportionateDistribution: false },
      partnerContext: { sharePercentage: 100, activeMutualContractsBalance: 0 },
    });
    const result = svc.evaluateDistribution(req);
    expect(result.locks.unpaidCapital.passed).toBe(true);
    expect(result.approvedAmount).toBe(10000);
  });
});
