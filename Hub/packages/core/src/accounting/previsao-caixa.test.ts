import { describe, it, expect } from 'vitest';
import { projetarCaixa, posicaoNoTeto } from './previsao-caixa';

const hoje = '2026-09-21';

describe('projetarCaixa', () => {
  it('acumula o saldo dia a dia, na ordem das datas', () => {
    const r = projetarCaixa({
      saldoInicial: 1000,
      hoje,
      compromissos: [
        { data: '2026-10-05', valor: 500, descricao: 'cliente', entrada: true },
        { data: '2026-10-01', valor: 300, descricao: 'aluguel', entrada: false },
      ],
    });
    expect(r.dias.map((d) => d.data)).toEqual(['2026-10-01', '2026-10-05']);
    expect(r.dias[0]!.saldo).toBe(700);
    expect(r.saldoFinal).toBe(1200);
  });

  it('aponta o dia em que o caixa fica negativo', () => {
    const r = projetarCaixa({
      saldoInicial: 500,
      hoje,
      compromissos: [
        { data: '2026-10-10', valor: 900, descricao: 'imposto', entrada: false },
        { data: '2026-11-10', valor: 2000, descricao: 'cliente', entrada: true },
      ],
    });
    expect(r.primeiroDiaNegativo).toBe('2026-10-10');
    expect(r.piorDia?.saldo).toBe(-400);
    // Mesmo terminando positivo, o buraco no meio é o que importa.
    expect(r.saldoFinal).toBe(1600);
  });

  it('traz conta vencida para hoje, em vez de ignorá-la', () => {
    // Deixá-la no passado mostraria um caixa melhor do que o real.
    const r = projetarCaixa({
      saldoInicial: 1000,
      hoje,
      compromissos: [{ data: '2026-09-01', valor: 400, descricao: 'atrasada', entrada: false }],
    });
    expect(r.dias[0]!.data).toBe(hoje);
    expect(r.saldoFinal).toBe(600);
  });

  it('ignora o que está além do horizonte', () => {
    const r = projetarCaixa({
      saldoInicial: 0,
      hoje,
      dias: 30,
      compromissos: [{ data: '2026-12-25', valor: 5000, descricao: 'longe', entrada: true }],
    });
    expect(r.dias).toHaveLength(0);
    expect(r.totalAReceber).toBe(0);
  });

  it('sem compromisso, o saldo final é o inicial', () => {
    const r = projetarCaixa({ saldoInicial: 2500, hoje, compromissos: [] });
    expect(r.saldoFinal).toBe(2500);
    expect(r.piorDia).toBeNull();
    expect(r.primeiroDiaNegativo).toBeNull();
  });
});

describe('posicaoNoTeto', () => {
  it('diz em que mês o limite é atingido no ritmo atual', () => {
    // Falta 1,2M para o teto, faturando 300k/mês → 4 meses.
    const r = posicaoNoTeto({
      rbt12: 3_600_000,
      mediaMensal: 300_000,
      limite: 4_800_000,
      mesCorrente: '2026-09',
    });
    expect(r.mesesAteOLimite).toBe(4);
    expect(r.mesDoEstouro).toBe('2027-01');
  });

  it('não projeta estouro para quem fatura pouco', () => {
    const r = posicaoNoTeto({
      rbt12: 200_000,
      mediaMensal: 20_000,
      limite: 4_800_000,
      mesCorrente: '2026-09',
    });
    // 230 meses — muito além do horizonte de 12.
    expect(r.mesDoEstouro).toBeNull();
    expect(r.folga).toBe(4_600_000);
  });

  it('quem já passou do limite tem folga negativa e zero meses', () => {
    const r = posicaoNoTeto({
      rbt12: 5_000_000,
      mediaMensal: 400_000,
      limite: 4_800_000,
      mesCorrente: '2026-09',
    });
    expect(r.folga).toBeLessThan(0);
    expect(r.mesesAteOLimite).toBe(0);
    expect(r.mesDoEstouro).toBe('2026-09');
  });

  it('empresa parada não estoura nada', () => {
    const r = posicaoNoTeto({
      rbt12: 100_000,
      mediaMensal: 0,
      limite: 4_800_000,
      mesCorrente: '2026-09',
    });
    expect(r.mesesAteOLimite).toBeNull();
    expect(r.mesDoEstouro).toBeNull();
  });
});
