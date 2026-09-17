import { describe, it, expect } from 'vitest';
import {
  paraOneflow,
  dataOneflow,
  montarDeParaPorCodigo,
  ContaSemMapeamentoError,
  type PartidaDoRazao,
} from './oneflow-mapping';

const partida = (over: Partial<PartidaDoRazao> = {}): PartidaDoRazao => ({
  entryDate: '2026-09-15',
  memo: 'NFSe 123 — Consultoria',
  linhas: [
    { accountCode: '1.1.02.001', direction: 'DEBIT', amount: 5000 },
    { accountCode: '3.1.1.01.01', direction: 'CREDIT', amount: 5000 },
  ],
  ...over,
});

const identidade = new Map<string, string>();

describe('formato de data', () => {
  it('converte ISO para o formato do OneFlow', () => {
    expect(dataOneflow('2026-09-15')).toBe('15/09/2026');
    expect(dataOneflow('2026-01-05T12:00:00Z')).toBe('05/01/2026');
  });
});

describe('conversão da partida', () => {
  it('traduz direção, valor e histórico', () => {
    const l = paraOneflow(partida(), identidade);
    expect(l.data).toBe('15/09/2026');
    expect(l.partidas.map((p) => p.d_c)).toEqual(['D', 'C']);
    expect(l.partidas[0]!.classificacao).toBe('1.1.02.001');
    expect(l.partidas[0]!.historico).toBe('NFSe 123 — Consultoria');
  });

  /**
   * O erro mais fácil de cometer: `valor` do cabeçalho é o total de UM lado.
   * Somar débito e crédito dobraria o lançamento, e os dois números existem e
   * são iguais — nada no código gritaria.
   */
  it('o valor do cabeçalho é um lado só, não a soma dos dois', () => {
    expect(paraOneflow(partida(), identidade).valor).toBe(5000);
  });

  it('valor do cabeçalho com várias linhas soma só os débitos', () => {
    const l = paraOneflow(
      partida({
        linhas: [
          { accountCode: '2.1.01.001', direction: 'DEBIT', amount: 1000 },
          { accountCode: '3.4.1.01.01', direction: 'DEBIT', amount: 30 },
          { accountCode: '1.1.01.002', direction: 'CREDIT', amount: 1030 },
        ],
      }),
      identidade,
    );
    expect(l.valor).toBe(1030);
    expect(l.partidas).toHaveLength(3);
  });

  it('usa o histórico da linha quando existe, e o do cabeçalho quando não', () => {
    const l = paraOneflow(
      partida({
        linhas: [
          { accountCode: '2.1.01.001', direction: 'DEBIT', amount: 100, lineMemo: 'Juros por atraso' },
          { accountCode: '1.1.01.002', direction: 'CREDIT', amount: 100 },
        ],
      }),
      identidade,
    );
    expect(l.partidas[0]!.historico).toBe('Juros por atraso');
    expect(l.partidas[1]!.historico).toBe('NFSe 123 — Consultoria');
  });

  it('separa CNPJ de cliente e de fornecedor', () => {
    const l = paraOneflow(
      partida({
        linhas: [
          {
            accountCode: '1.1.02.001',
            direction: 'DEBIT',
            amount: 500,
            partnerDocument: '12.345.678/0001-95',
            partnerName: 'Cliente X',
          },
          { accountCode: '3.1.1.01.01', direction: 'CREDIT', amount: 500 },
        ],
      }),
      identidade,
    );
    expect(l.partidas[0]!.cnpjCli).toBe('12345678000195');
    expect(l.partidas[0]!.cnpjForn).toBeUndefined();
    expect(l.partidas[0]!.razaoSocial).toBe('Cliente X');
  });

  it('centro de custo vira rateio', () => {
    const l = paraOneflow(
      partida({
        linhas: [
          { accountCode: '3.3.2.02.01', direction: 'DEBIT', amount: 800, costCenterCode: 'ADM' },
          { accountCode: '2.1.01.001', direction: 'CREDIT', amount: 800 },
        ],
      }),
      identidade,
    );
    expect(l.partidas[0]!.rateios).toEqual([{ CodCentroCusto: 'ADM', valor: 800 }]);
  });
});

describe('de-para de contas', () => {
  it('traduz pelo mapa quando ele existe', () => {
    const mapa = new Map([
      ['1.1.02.001', '1.01.02.0001'],
      ['3.1.1.01.01', '3.01.01.0001'],
    ]);
    const l = paraOneflow(partida(), mapa);
    expect(l.partidas.map((p) => p.classificacao)).toEqual(['1.01.02.0001', '3.01.01.0001']);
  });

  /**
   * Conta sem correspondência FALHA em vez de mandar o código cru. Enviar o
   * nosso código para um plano de numeração diferente faria o lançamento ser
   * recusado — ou, pior, aceito numa conta errada, e ninguém descobre até o
   * balanço.
   */
  it('recusa a conversão quando falta correspondência, nomeando as contas', () => {
    const mapa = new Map([['1.1.02.001', '1.01.02.0001']]);
    expect(() => paraOneflow(partida(), mapa)).toThrow(ContaSemMapeamentoError);
    try {
      paraOneflow(partida(), mapa);
    } catch (e) {
      expect((e as ContaSemMapeamentoError).codigos).toEqual(['3.1.1.01.01']);
      expect((e as Error).message).toMatch(/3\.1\.1\.01\.01/);
    }
  });

  it('monta o de-para por código e lista o que não casou', () => {
    const { mapa, semCorrespondencia } = montarDeParaPorCodigo(
      [{ code: '1.1.02.001' }, { code: '9.9.9.99' }],
      [{ classificacao: '1.1.02.001' }, { classificacao: '2.1.01.001' }],
    );
    expect(mapa.get('1.1.02.001')).toBe('1.1.02.001');
    expect(semCorrespondencia).toEqual(['9.9.9.99']);
  });
});
