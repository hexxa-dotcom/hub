import { describe, it, expect } from 'vitest';
import { montarLotes, juntarLote, LANCAMENTOS_POR_COMPOSTO, type PartidaParaEnvio } from './envio-oneflow';

const p = (id: string, data: string, valor: number, tentativas = 0): PartidaParaEnvio => ({
  journalEntryId: `${id}0000000-0000-0000-0000-000000000000`.slice(0, 36),
  data,
  valor,
  tentativas,
  documento: `HUB-${id}`,
  partidas: [
    { valor, d_c: 'D', historico: `débito ${id}`, classificacao: '1.1.1.02' },
    { valor, d_c: 'C', historico: `crédito ${id}`, classificacao: '3.1.1.01' },
  ],
});

describe('lançamento composto', () => {
  it('junta as partidas do mesmo dia num lançamento só', () => {
    const lotes = montarLotes([p('a', '01/08/2026', 10), p('b', '01/08/2026', 20), p('c', '02/08/2026', 5)]);
    expect(lotes.map((l) => l.length)).toEqual([2, 1]);
  });

  it('respeita o teto por composto', () => {
    const muitas = Array.from({ length: LANCAMENTOS_POR_COMPOSTO + 3 }, (_, i) => p(String(i).padStart(2, '0'), '05/08/2026', 1));
    expect(montarLotes(muitas).map((l) => l.length)).toEqual([LANCAMENTOS_POR_COMPOSTO, 3]);
  });

  it('quem já foi recusado vai sozinho', () => {
    const lotes = montarLotes([p('a', '01/08/2026', 10), p('b', '01/08/2026', 20, 1), p('c', '01/08/2026', 5)]);
    expect(lotes.map((l) => l.map((x) => x.journalEntryId.slice(0, 1)))).toEqual([['b'], ['a', 'c']]);
  });

  it('o composto fecha: débitos = créditos = soma dos valores, com todas as partidas', () => {
    const l = juntarLote([p('a', '01/08/2026', 10.1), p('b', '01/08/2026', 20.25)]);
    expect(l.valor).toBe(30.35);
    expect(l.partidas).toHaveLength(4);
    const lado = (dc: 'D' | 'C') => l.partidas.filter((x) => x.d_c === dc).reduce((s, x) => s + Math.round(x.valor * 100), 0);
    expect(lado('D')).toBe(lado('C'));
    expect(l.documento).toBe('HUB-a0000000+1');
  });

  it('sozinho continua igual ao envio de antes', () => {
    const um = p('a', '01/08/2026', 10);
    expect(juntarLote([um])).toEqual({ data: um.data, valor: 10, documento: 'HUB-a', partidas: um.partidas });
  });
});
