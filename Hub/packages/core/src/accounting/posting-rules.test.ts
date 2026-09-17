import { describe, it, expect } from 'vitest';
import {
  accrueFinancialEntry,
  settleFinancialEntry,
  accrueTaxGuide,
  settleTaxGuide,
  accruePayslip,
  settlePayslip,
  accrueProfitDistribution,
  settleProfitDistribution,
  reverseEntry,
  assertBalanced,
  UnbalancedEntryError,
  SemContaContabilError,
  type JournalDraft,
} from './posting-rules';
import { ACCOUNTS, DEFAULT_CHART, natureOf, parentCodeOf, deriveResultAccounts } from './chart-of-accounts';

/** Soma um lado da partida, em centavos, para não comparar float. */
const soma = (d: JournalDraft, lado: 'DEBIT' | 'CREDIT') =>
  d.lines.filter((l) => l.direction === lado).reduce((s, l) => s + Math.round(l.amount * 100), 0);

const fecha = (d: JournalDraft) => soma(d, 'DEBIT') === soma(d, 'CREDIT');

const conta = (d: JournalDraft, code: string, lado: 'DEBIT' | 'CREDIT') =>
  d.lines.find((l) => l.accountCode === code && l.direction === lado);

describe('invariante da partida dobrada', () => {
  it('recusa partida que não fecha', () => {
    expect(() =>
      assertBalanced({
        entryDate: '2026-09-01',
        referenceMonth: '2026-09-01',
        memo: 'x',
        source: 'MANUAL',
        sourceId: null,
        event: 'ADJUSTMENT',
        lines: [
          { accountCode: ACCOUNTS.BANCOS, direction: 'DEBIT', amount: 100 },
          { accountCode: ACCOUNTS.CLIENTES, direction: 'CREDIT', amount: 99.99 },
        ],
      }),
    ).toThrow(UnbalancedEntryError);
  });

  it('recusa partida de uma linha só', () => {
    expect(() =>
      assertBalanced({
        entryDate: '2026-09-01',
        referenceMonth: '2026-09-01',
        memo: 'x',
        source: 'MANUAL',
        sourceId: null,
        event: 'ADJUSTMENT',
        lines: [{ accountCode: ACCOUNTS.BANCOS, direction: 'DEBIT', amount: 100 }],
      }),
    ).toThrow();
  });

  it('recusa valor negativo — o lado é o enum, não o sinal', () => {
    expect(() =>
      assertBalanced({
        entryDate: '2026-09-01',
        referenceMonth: '2026-09-01',
        memo: 'x',
        source: 'MANUAL',
        sourceId: null,
        event: 'ADJUSTMENT',
        lines: [
          { accountCode: ACCOUNTS.BANCOS, direction: 'DEBIT', amount: -100 },
          { accountCode: ACCOUNTS.CLIENTES, direction: 'CREDIT', amount: -100 },
        ],
      }),
    ).toThrow(/não positivo/);
  });

  it('fecha com centavos que quebram em float (0.1 + 0.2)', () => {
    const d = assertBalanced({
      entryDate: '2026-09-01',
      referenceMonth: '2026-09-01',
      memo: 'x',
      source: 'MANUAL',
      sourceId: null,
      event: 'ADJUSTMENT',
      lines: [
        { accountCode: ACCOUNTS.BANCOS, direction: 'DEBIT', amount: 0.1 },
        { accountCode: ACCOUNTS.CAIXA, direction: 'DEBIT', amount: 0.2 },
        { accountCode: ACCOUNTS.CLIENTES, direction: 'CREDIT', amount: 0.3 },
      ],
    });
    expect(fecha(d)).toBe(true);
  });
});

describe('lançamento financeiro', () => {
  const receber = {
    id: 'fe-1',
    type: 'RECEIVABLE' as const,
    description: 'NFSe 123 — Consultoria',
    amount: 5000,
    dueDate: '2026-09-10',
    referenceMonth: '2026-09-01',
  };

  it('reconhece receita contra Clientes, não contra Banco', () => {
    const d = accrueFinancialEntry(receber);
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.CLIENTES, 'DEBIT')?.amount).toBe(5000);
    expect(conta(d, ACCOUNTS.RECEITA_SERVICOS, 'CREDIT')?.amount).toBe(5000);
    // Competência: o dinheiro ainda não entrou.
    expect(conta(d, ACCOUNTS.BANCOS, 'DEBIT')).toBeUndefined();
  });

  it('usa a conta da categoria quando ela tem código contábil', () => {
    const d = accrueFinancialEntry({
      ...receber,
      type: 'PAYABLE',
      resultAccountCode: '3.3.2.02.05',
    });
    expect(conta(d, '3.3.2.02.05', 'DEBIT')?.amount).toBe(5000);
    expect(conta(d, ACCOUNTS.FORNECEDORES, 'CREDIT')?.amount).toBe(5000);
  });

  /**
   * A ITG 1000 não prevê conta "a classificar". Usar uma produzia balanço de
   * perna quebrada — um terço do custo numa linha que não diz nada. Agora a
   * escrituração recusa, e o documento fica pendente até alguém classificar.
   */
  it('RECUSA escriturar despesa sem conta contábil, em vez de usar um balde', () => {
    expect(() =>
      accrueFinancialEntry({ ...receber, type: 'PAYABLE', resultAccountCode: null }),
    ).toThrow(SemContaContabilError);
  });

  it('receita sem categoria ainda tem conta — serviço prestado é o padrão', () => {
    const d = accrueFinancialEntry({ ...receber, resultAccountCode: null });
    expect(conta(d, ACCOUNTS.RECEITA_SERVICOS, 'CREDIT')?.amount).toBe(5000);
  });

  it('liquidação com juros: separa o juro do principal', () => {
    // Conta de R$ 1.000 paga com R$ 30 de juros.
    const d = settleFinancialEntry({
      id: 'fe-2',
      type: 'PAYABLE',
      description: 'Aluguel',
      amount: 1030,
      originalAmount: 1000,
      interest: 30,
      dueDate: '2026-09-05',
      referenceMonth: '2026-09-01',
      paidAt: '2026-09-12',
    });
    expect(fecha(d)).toBe(true);
    // O passivo baixa pelo valor original — não pelo valor pago.
    expect(conta(d, ACCOUNTS.FORNECEDORES, 'DEBIT')?.amount).toBe(1000);
    expect(conta(d, ACCOUNTS.JUROS_PASSIVOS, 'DEBIT')?.amount).toBe(30);
    expect(conta(d, ACCOUNTS.BANCOS, 'CREDIT')?.amount).toBe(1030);
  });

  it('liquidação com desconto concedido: recebe menos e reconhece a perda', () => {
    const d = settleFinancialEntry({
      id: 'fe-3',
      type: 'RECEIVABLE',
      description: 'Cliente X',
      amount: 950,
      originalAmount: 1000,
      discount: 50,
      dueDate: '2026-09-05',
      referenceMonth: '2026-09-01',
      paidAt: '2026-09-03',
    });
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.BANCOS, 'DEBIT')?.amount).toBe(950);
    expect(conta(d, ACCOUNTS.DESCONTOS_CONCEDIDOS, 'DEBIT')?.amount).toBe(50);
    expect(conta(d, ACCOUNTS.CLIENTES, 'CREDIT')?.amount).toBe(1000);
  });

  it('a liquidação vai para o mês do pagamento, não o da competência', () => {
    const d = settleFinancialEntry({
      id: 'fe-4',
      type: 'RECEIVABLE',
      description: 'Cliente Y',
      amount: 500,
      dueDate: '2026-08-28',
      referenceMonth: '2026-08-01',
      paidAt: '2026-09-02',
    });
    expect(d.referenceMonth).toBe('2026-09-01');
  });
});

describe('guia de imposto', () => {
  const das = {
    id: 'tg-1',
    taxName: 'DAS - Simples Nacional',
    amount: 1200,
    dueDate: '2026-09-20',
    referenceMonth: '2026-09-01',
  };

  it('DAS entra como dedução da receita, com passivo próprio', () => {
    const d = accrueTaxGuide(das);
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.IMPOSTO_SIMPLES, 'DEBIT')?.amount).toBe(1200);
    expect(conta(d, ACCOUNTS.DAS_A_RECOLHER, 'CREDIT')?.amount).toBe(1200);
  });

  it('tributo que não é DAS não cai na conta do Simples', () => {
    const d = accrueTaxGuide({ ...das, taxName: 'INSS sobre pró-labore' });
    expect(conta(d, ACCOUNTS.IMPOSTO_SIMPLES, 'DEBIT')).toBeUndefined();
    expect(conta(d, ACCOUNTS.IMPOSTO_OUTROS, 'DEBIT')?.amount).toBe(1200);
    expect(conta(d, ACCOUNTS.IMPOSTOS_A_RECOLHER, 'CREDIT')?.amount).toBe(1200);
  });

  it('pagamento baixa o passivo contra o banco', () => {
    const d = settleTaxGuide({ ...das, paidAt: '2026-09-19' });
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.DAS_A_RECOLHER, 'DEBIT')?.amount).toBe(1200);
    expect(conta(d, ACCOUNTS.BANCOS, 'CREDIT')?.amount).toBe(1200);
  });
});

describe('folha e distribuição de lucros', () => {
  it('folha: despesa contra salários a pagar', () => {
    const d = accruePayslip({
      id: 'ps-1',
      employeeName: 'Maria',
      netAmount: 3000,
      referenceMonth: '2026-09-01',
    });
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.DESPESA_PESSOAL, 'DEBIT')?.amount).toBe(3000);
    expect(conta(d, ACCOUNTS.SALARIOS_A_PAGAR, 'CREDIT')?.amount).toBe(3000);
  });

  it('folha paga baixa o passivo', () => {
    const d = settlePayslip({
      id: 'ps-1',
      employeeName: 'Maria',
      netAmount: 3000,
      referenceMonth: '2026-09-01',
      paidAt: '2026-10-05',
    });
    expect(conta(d, ACCOUNTS.SALARIOS_A_PAGAR, 'DEBIT')?.amount).toBe(3000);
    expect(d.referenceMonth).toBe('2026-10-01');
  });

  it('distribuição de lucro NÃO passa por conta de resultado', () => {
    const d = accrueProfitDistribution({
      id: 'pd-1',
      partnerName: 'Filipe',
      amount: 8000,
      distributedAt: '2026-09-15',
    });
    expect(fecha(d)).toBe(true);
    expect(conta(d, ACCOUNTS.LUCROS_ACUMULADOS, 'DEBIT')?.amount).toBe(8000);
    expect(conta(d, ACCOUNTS.LUCROS_A_PAGAR, 'CREDIT')?.amount).toBe(8000);
    // Dividendo não é despesa: se fosse, derrubaria o lucro que o originou.
    expect(d.lines.every((l) => !l.accountCode.startsWith('3.'))).toBe(true);
  });

  it('pagamento do lucro baixa a obrigação com o sócio', () => {
    const d = settleProfitDistribution({
      id: 'pd-1',
      partnerName: 'Filipe',
      amount: 8000,
      distributedAt: '2026-09-15',
    });
    expect(conta(d, ACCOUNTS.LUCROS_A_PAGAR, 'DEBIT')?.amount).toBe(8000);
    expect(conta(d, ACCOUNTS.BANCOS, 'CREDIT')?.amount).toBe(8000);
  });
});

describe('estorno', () => {
  it('espelha a partida invertendo cada lado e continua fechando', () => {
    const original = accrueFinancialEntry({
      id: 'fe-9',
      type: 'RECEIVABLE',
      description: 'Nota cancelada',
      amount: 2500,
      dueDate: '2026-09-10',
      referenceMonth: '2026-09-01',
    });
    const estorno = reverseEntry(original, 'nota cancelada na prefeitura', '2026-09-18');

    expect(fecha(estorno)).toBe(true);
    expect(estorno.event).toBe('REVERSAL');
    expect(conta(estorno, ACCOUNTS.CLIENTES, 'CREDIT')?.amount).toBe(2500);
    expect(conta(estorno, ACCOUNTS.RECEITA_SERVICOS, 'DEBIT')?.amount).toBe(2500);
  });
});

describe('plano de contas', () => {
  it('natureza é derivada do grupo', () => {
    expect(natureOf('ATIVO')).toBe('DEBIT');
    expect(natureOf('DESPESA')).toBe('DEBIT');
    expect(natureOf('PASSIVO')).toBe('CREDIT');
    expect(natureOf('RECEITA')).toBe('CREDIT');
    expect(natureOf('PATRIMONIO_LIQUIDO')).toBe('CREDIT');
  });

  it('parentCode sobe um nível', () => {
    expect(parentCodeOf('1.1.02.001')).toBe('1.1.02');
    expect(parentCodeOf('1')).toBeNull();
  });

  it('não tem código duplicado', () => {
    const codes = DEFAULT_CHART.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('toda analítica tem a sintética-pai no plano', () => {
    const codes = new Set(DEFAULT_CHART.map((a) => a.code));
    const orfas = DEFAULT_CHART.filter((a) => {
      const pai = parentCodeOf(a.code);
      return pai !== null && !codes.has(pai);
    });
    expect(orfas.map((o) => o.code)).toEqual([]);
  });

  /**
   * Este é o teste que impede a regressão mais provável deste módulo: uma
   * regra de lançamento nova citando um código que ninguém cadastrou. O banco
   * rejeitaria com violação de FK em produção — aqui falha na hora.
   */
  it('toda conta citada pelas regras existe no plano e é analítica', () => {
    const porCodigo = new Map(DEFAULT_CHART.map((a) => [a.code, a]));
    for (const [nome, code] of Object.entries(ACCOUNTS)) {
      const conta = porCodigo.get(code);
      expect(conta, `ACCOUNTS.${nome} (${code}) não está no DEFAULT_CHART`).toBeDefined();
      expect(conta!.analytical, `ACCOUNTS.${nome} (${code}) é sintética`).toBe(true);
    }
  });

  it('deriva conta de resultado a partir da categoria, com as sintéticas do caminho', () => {
    const contas = deriveResultAccounts([
      // Conta de Despesas com VENDAS — fora do plano padrão, que cobre as
      // Administrativas. É o caso real: categoria da empresa que o plano
      // mínimo não traz.
      { name: 'Propaganda e Publicidade', accountingCode: '3.3.1.02.02', kind: 'EXPENSE' },
      { name: 'Sem código', accountingCode: null, kind: 'EXPENSE' },
      { name: 'Código de ativo, não de resultado', accountingCode: '1.1.01.001', kind: 'EXPENSE' },
    ]);
    const codes = contas.map((c) => c.code);

    expect(codes).toContain('3.3.1.02.02');
    expect(contas.find((c) => c.code === '3.3.1.02.02')!.analytical).toBe(true);
    // Cria as sintéticas do caminho que faltam…
    expect(codes).toContain('3.3.1.02');
    // …mas não duplica o que o plano padrão já traz.
    expect(codes).not.toContain('3.3');
    // Ignora categoria sem código e código fora do grupo 3.
    expect(codes).not.toContain('1.1.01.001');
  });
});

describe('conta pela origem do lançamento', () => {
  const base = {
    id: 'fe-src',
    type: 'PAYABLE' as const,
    description: 'Folha de Pagamento — Maria',
    amount: 3000,
    dueDate: '2026-09-05',
    referenceMonth: '2026-09-01',
  };

  /**
   * A folha grava payslip E financial_entry para o mesmo fato. Escriturar os
   * dois dobraria o custo de pessoal, então a folha é escriturada só pelo
   * lançamento financeiro — e `source` é o que o manda à conta certa.
   */
  it('PAYROLL vai para despesa com pessoal — a origem é informação de verdade', () => {
    const d = accrueFinancialEntry({ ...base, source: 'PAYROLL' });
    expect(conta(d, ACCOUNTS.DESPESA_PESSOAL, 'DEBIT')?.amount).toBe(3000);
  });

  it('a categoria, quando tem código, ganha da origem', () => {
    const d = accrueFinancialEntry({ ...base, source: 'PAYROLL', resultAccountCode: '3.3.1.01.01' });
    expect(conta(d, '3.3.1.01.01', 'DEBIT')?.amount).toBe(3000);
    expect(conta(d, ACCOUNTS.DESPESA_PESSOAL, 'DEBIT')).toBeUndefined();
  });

  it('origem desconhecida sem categoria é recusada, não empurrada para um balde', () => {
    expect(() => accrueFinancialEntry({ ...base, source: 'MANUAL' })).toThrow(SemContaContabilError);
  });
});

describe('segregação do DAS (ITG 1000, Anexo 3)', () => {
  /** Repartição real do Anexo III, faixa 1 — vem da LC 123, não é estimativa. */
  const anexoIII = { cpp: 43.4, iss: 33.5, pis: 2.78, csll: 3.5, irpj: 4, cofins: 12.82 };

  const das = {
    id: 'tg-seg',
    taxName: 'DAS - Simples Nacional',
    amount: 1000,
    dueDate: '2026-09-20',
    referenceMonth: '2026-09-01',
  };

  /**
   * O ponto da norma: a guia é uma, os tributos dentro dela vão para três
   * lugares diferentes da DRE. Lançar tudo como dedução infla a dedução e
   * some com o IRPJ.
   */
  it('abre a guia nos tributos que ela embute', () => {
    const d = accrueTaxGuide({ ...das, reparticao: anexoIII });
    expect(fecha(d)).toBe(true);

    expect(conta(d, ACCOUNTS.IMPOSTO_ISS, 'DEBIT')?.amount).toBe(335);
    expect(conta(d, ACCOUNTS.IMPOSTO_COFINS, 'DEBIT')?.amount).toBe(128.2);
    expect(conta(d, ACCOUNTS.IMPOSTO_PIS, 'DEBIT')?.amount).toBe(27.8);
    // Tributos sobre o LUCRO — abaixo da linha na DRE, não deduzem receita.
    expect(conta(d, ACCOUNTS.IRPJ, 'DEBIT')?.amount).toBe(40);
    expect(conta(d, ACCOUNTS.CSLL, 'DEBIT')?.amount).toBe(35);
    // CPP é encargo patronal, não tributo sobre receita.
    expect(conta(d, ACCOUNTS.ENCARGOS_PESSOAL, 'DEBIT')?.amount).toBe(434);

    expect(conta(d, ACCOUNTS.DAS_A_RECOLHER, 'CREDIT')?.amount).toBe(1000);
  });

  it('a soma das partes é exatamente a guia', () => {
    const d = accrueTaxGuide({ ...das, reparticao: anexoIII });
    const debitos = d.lines.filter((l) => l.direction === 'DEBIT');
    const soma = debitos.reduce((s, l) => s + Math.round(l.amount * 100), 0);
    expect(soma).toBe(100_000);
  });

  /**
   * Percentual sobre reais quase nunca fecha na casa dos centavos. Uma partida
   * que erra R$ 0,01 é recusada — pelo razão e pelo OneFlow.
   */
  it('o centavo perdido no rateio vai para a maior linha', () => {
    const d = accrueTaxGuide({ ...das, amount: 333.33, reparticao: anexoIII });
    expect(fecha(d)).toBe(true);
    const soma = d.lines
      .filter((l) => l.direction === 'DEBIT')
      .reduce((s, l) => s + Math.round(l.amount * 100), 0);
    expect(soma).toBe(33_333);
  });

  it('valores quebrados continuam fechando em 50 sorteios', () => {
    for (let i = 0; i < 50; i++) {
      const valor = Math.round(Math.random() * 500_000) / 100;
      if (valor <= 0) continue;
      const d = accrueTaxGuide({ ...das, amount: valor, reparticao: anexoIII });
      expect(fecha(d), `valor ${valor}`).toBe(true);
    }
  });

  /**
   * Sem repartição conhecida, uma linha só. É pior contabilmente, mas
   * inventar a proporção seria afirmar um número que ninguém apurou.
   */
  it('sem repartição, cai numa linha só e não inventa proporção', () => {
    const d = accrueTaxGuide(das);
    expect(fecha(d)).toBe(true);
    expect(d.lines.filter((l) => l.direction === 'DEBIT')).toHaveLength(1);
    expect(conta(d, ACCOUNTS.IMPOSTO_SIMPLES, 'DEBIT')?.amount).toBe(1000);
  });

  it('repartição vazia é tratada como ausente', () => {
    const d = accrueTaxGuide({ ...das, reparticao: {} });
    expect(d.lines.filter((l) => l.direction === 'DEBIT')).toHaveLength(1);
  });

  it('a baixa continua sendo uma só — o passivo é único', () => {
    const d = settleTaxGuide({ ...das, reparticao: anexoIII, paidAt: '2026-09-19' });
    expect(conta(d, ACCOUNTS.DAS_A_RECOLHER, 'DEBIT')?.amount).toBe(1000);
    expect(conta(d, ACCOUNTS.BANCOS, 'CREDIT')?.amount).toBe(1000);
  });
});
