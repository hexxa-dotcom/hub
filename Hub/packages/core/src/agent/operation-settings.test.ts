import { describe, it, expect } from 'vitest';
import {
  resolverConfiguracao,
  temExcecao,
  excecoes,
  PADRAO_SISTEMA,
  LIMITE_DIRETRIZES,
  dataDoFechamento,
  mesQueFechaEm,
} from './operation-settings';

describe('herança em três camadas', () => {
  /**
   * O caso que responde a pergunta "vou ter que mexer em cada empresa nova?":
   * não. Sem exceção nenhuma, a empresa nasce com tudo funcionando.
   */
  it('empresa sem exceção herda o padrão inteiro', () => {
    const r = resolverConfiguracao('SERVICE');
    expect(r.valores.agentes).toEqual(PADRAO_SISTEMA.agentes);
    expect(temExcecao(r.origem)).toBe(false);
    expect(excecoes(r.origem)).toEqual([]);
  });

  it('a camada da empresa ganha da do sistema', () => {
    const r = resolverConfiguracao(
      'SERVICE',
      { agentes: { classificador: true } },
      { agentes: { classificador: false } },
    );
    expect(r.valores.agentes.classificador).toBe(false);
    expect(r.origem.agentes.classificador).toBe('empresa');
  });

  it('o perfil ganha do sistema e perde para a empresa', () => {
    const semExcecao = resolverConfiguracao('HOLDING');
    expect(semExcecao.valores.autonomia.tetos.EMITIR_NFSE).toBe('APPROVAL');
    // Veio do perfil, não do sistema — e a tela precisa poder dizer isso.
    expect(semExcecao.origem.autonomia.tetos).toBe('perfil');

    const comExcecao = resolverConfiguracao('HOLDING', undefined, {
      autonomia: { tetos: {}, limites: {}, confiancaMinimaAuto: 0.9 },
    });
    expect(comExcecao.valores.autonomia.confiancaMinimaAuto).toBe(0.9);
    expect(comExcecao.origem.autonomia.confiancaMinimaAuto).toBe('empresa');
  });

  /**
   * O ganho de guardar só o delta: melhorar o padrão chega às empresas
   * existentes sem migração. Aqui, desligar um agente no sistema desliga em
   * quem não sobrescreveu, e não mexe em quem sobrescreveu.
   */
  it('mudar o padrão alcança quem não sobrescreveu, e só esses', () => {
    const herdeira = resolverConfiguracao('SERVICE', { agentes: { insights: false } });
    expect(herdeira.valores.agentes.insights).toBe(false);

    const propria = resolverConfiguracao(
      'SERVICE',
      { agentes: { insights: false } },
      { agentes: { insights: true } },
    );
    expect(propria.valores.agentes.insights).toBe(true);
  });

  it('a origem de cada chave fica registrada para a tela mostrar', () => {
    const r = resolverConfiguracao(
      'SERVICE',
      { agentes: { conciliador: false } },
      { agentes: { fechamento: false } },
    );
    expect(r.origem.agentes.conciliador).toBe('sistema');
    expect(r.origem.agentes.fechamento).toBe('empresa');
    expect(r.origem.agentes.classificador).toBe('sistema');
    expect(excecoes(r.origem)).toEqual(['agentes.fechamento']);
  });
});

describe('perfis por tipo de empresa', () => {
  /**
   * Holding patrimonial não presta serviço. Deixar a emissão de nota
   * disponível seria convidar o agente a propor algo que nunca se aplica — e o
   * contador aprenderia a ignorar a fila de aprovação.
   */
  it('holding exige aprovação para emitir nota; prestadora não herda essa trava', () => {
    expect(resolverConfiguracao('HOLDING').valores.autonomia.tetos.EMITIR_NFSE).toBe('APPROVAL');
    expect(resolverConfiguracao('SERVICE').valores.autonomia.tetos.EMITIR_NFSE).toBeUndefined();
  });

  it('os dois perfis mantêm os agentes contábeis ligados', () => {
    for (const perfil of ['SERVICE', 'HOLDING'] as const) {
      const v = resolverConfiguracao(perfil).valores.agentes;
      expect(v.escrituracao, perfil).toBe(true);
      expect(v.classificador, perfil).toBe(true);
    }
  });
});

describe('diretrizes', () => {
  it('a diretriz da empresa substitui a do sistema', () => {
    const r = resolverConfiguracao(
      'SERVICE',
      { diretrizes: 'Padrão da casa.' },
      { diretrizes: 'Dr. Henrique é PJ, não cliente.' },
    );
    expect(r.valores.diretrizes).toBe('Dr. Henrique é PJ, não cliente.');
    expect(r.origem.diretrizes).toBe('empresa');
  });

  /**
   * Corta em vez de recusar: derrubar a resolução inteira por causa de uma
   * diretriz longa demais deixaria a empresa sem configuração nenhuma.
   */
  it('diretriz longa demais é cortada, não derruba a configuração', () => {
    const r = resolverConfiguracao('SERVICE', undefined, { diretrizes: 'x'.repeat(5000) });
    expect(r.valores.diretrizes).toHaveLength(LIMITE_DIRETRIZES);
    expect(r.valores.agentes.classificador).toBe(true);
  });

  it('string vazia é uma escolha válida, não "não configurado"', () => {
    const r = resolverConfiguracao('SERVICE', { diretrizes: 'algo' }, { diretrizes: '' });
    expect(r.valores.diretrizes).toBe('');
    expect(r.origem.diretrizes).toBe('empresa');
  });
});

describe('a resolução é previsível', () => {
  /** Última camada ganha, sem ponderação. Configuração sutil é imprevisível. */
  it('nunca mescla dois valores num terceiro', () => {
    const r = resolverConfiguracao(
      'SERVICE',
      { autonomia: { tetos: { EMITIR_NFSE: 'REVIEW' }, limites: {}, confiancaMinimaAuto: 0.7 } },
      { autonomia: { tetos: { PAGAR_GUIA: 'APPROVAL' }, limites: {}, confiancaMinimaAuto: 0.95 } },
    );
    // A camada da empresa substitui o objeto inteiro de tetos — não funde.
    expect(r.valores.autonomia.tetos).toEqual({ PAGAR_GUIA: 'APPROVAL' });
    expect(r.valores.autonomia.confiancaMinimaAuto).toBe(0.95);
  });

  it('valores undefined no patch não apagam o herdado', () => {
    const r = resolverConfiguracao('SERVICE', undefined, {
      agentes: { classificador: undefined, fechamento: false },
    });
    expect(r.valores.agentes.classificador).toBe(true);
    expect(r.valores.agentes.fechamento).toBe(false);
  });
});

describe('dia de fechamento por empresa', () => {
  it('dia 1 fecha o mês anterior no primeiro dia do mês seguinte', () => {
    expect(dataDoFechamento('2026-08', 1)).toBe('2026-09-01');
    expect(mesQueFechaEm('2026-09-01', 1)).toBe('2026-08');
  });

  it('dia 0 fecha o PRÓPRIO mês, no último dia dele', () => {
    // O caso que quebra a pergunta feita de frente: aqui o mês que tranca é
    // o corrente, não o anterior.
    expect(dataDoFechamento('2026-09', 0)).toBe('2026-09-30');
    expect(mesQueFechaEm('2026-09-30', 0)).toBe('2026-09');
  });

  it('dia 0 acerta fevereiro bissexto', () => {
    expect(mesQueFechaEm('2024-02-29', 0)).toBe('2024-02');
    expect(mesQueFechaEm('2025-02-28', 0)).toBe('2025-02');
  });

  it('dia 10 fecha o mês anterior no dia 10', () => {
    expect(mesQueFechaEm('2026-09-10', 10)).toBe('2026-08');
  });

  it('devolve null na esmagadora maioria dos dias', () => {
    expect(mesQueFechaEm('2026-09-07', 1)).toBeNull();
    expect(mesQueFechaEm('2026-09-15', 10)).toBeNull();
  });

  it('atravessa a virada do ano', () => {
    expect(mesQueFechaEm('2027-01-01', 1)).toBe('2026-12');
    expect(dataDoFechamento('2026-12', 1)).toBe('2027-01-01');
  });

  it('o dia configurado nunca alcança o vencimento do DAS', () => {
    // O teto de 20 existe para isso: um mês que ainda não fechou não tem
    // guia apurada para pagar no dia 20.
    expect(mesQueFechaEm('2026-09-20', 20)).toBe('2026-08');
    expect(mesQueFechaEm('2026-09-21', 20)).toBeNull();
  });
});
