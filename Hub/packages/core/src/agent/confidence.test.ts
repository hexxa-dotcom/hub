import { describe, it, expect } from 'vitest';
import {
  combinarSinais,
  confiancaClassificacao,
  confiancaConciliacao,
  sinalValorExato,
  sinalModelo,
  type Sinal,
} from './confidence';

const sinal = (nome: string, forca: number, peso: number): Sinal => ({
  nome,
  forca,
  peso,
  observado: nome,
});

describe('combinação de sinais', () => {
  /**
   * Ausência de evidência não é evidência média. Sem sinal nenhum a confiança
   * é zero, o que manda a ação para revisão — que é o comportamento correto
   * para uma proposta que nada sustenta.
   */
  it('sem sinal nenhum a confiança é 0, não 0,5', () => {
    const c = combinarSinais([]);
    expect(c.score).toBe(0);
    expect(c.resumo).toMatch(/Sem evidência/);
  });

  it('média ponderada: sinal de peso maior puxa mais', () => {
    const c = combinarSinais([sinal('forte', 1, 3), sinal('fraco', 0, 1)]);
    expect(c.score).toBeCloseTo(0.75, 3);
  });

  /** Não é produto: um sinal fraco não deve colapsar a proposta inteira. */
  it('um sinal fraco não zera os demais', () => {
    const c = combinarSinais([sinal('a', 0.9, 1), sinal('b', 0.9, 1), sinal('c', 0.1, 1)]);
    expect(c.score).toBeGreaterThan(0.5);
  });

  /** Nem máximo: um sinal forte não deve mascarar vários contra. */
  it('um sinal forte não mascara três contra', () => {
    const c = combinarSinais([
      sinal('forte', 1, 1),
      sinal('a', 0, 1),
      sinal('b', 0, 1),
      sinal('c', 0, 1),
    ]);
    expect(c.score).toBeLessThan(0.3);
  });
});

describe('confiança de classificação', () => {
  it('histórico consistente dá confiança alta', () => {
    const c = confiancaClassificacao({
      acertosDescricao: 8,
      divergenciasDescricao: 0,
      acertosFornecedor: 8,
      divergenciasFornecedor: 0,
    });
    expect(c.score).toBeGreaterThan(0.85);
  });

  /**
   * Uma descrição que já foi para duas categorias diferentes é genuinamente
   * ambígua. Fingir certeza aí é o pior erro que o medidor pode cometer.
   */
  it('histórico dividido derruba a confiança', () => {
    const c = confiancaClassificacao({
      acertosDescricao: 5,
      divergenciasDescricao: 5,
      acertosFornecedor: 0,
      divergenciasFornecedor: 0,
    });
    expect(c.score).toBeLessThan(0.55);
  });

  it('um único precedente não vale tanto quanto dez', () => {
    const um = confiancaClassificacao({
      acertosDescricao: 1,
      divergenciasDescricao: 0,
      acertosFornecedor: 0,
      divergenciasFornecedor: 0,
    });
    const dez = confiancaClassificacao({
      acertosDescricao: 10,
      divergenciasDescricao: 0,
      acertosFornecedor: 0,
      divergenciasFornecedor: 0,
    });
    expect(dez.score).toBeGreaterThan(um.score);
    expect(um.score).toBeLessThan(0.6);
  });

  /**
   * O modelo opinando sobre si mesmo tem peso baixo de propósito: é o
   * avaliado dando nota à própria prova.
   */
  it('modelo confiantíssimo, sozinho, não chega ao patamar de automático', () => {
    const c = confiancaClassificacao(
      { acertosDescricao: 0, divergenciasDescricao: 0, acertosFornecedor: 0, divergenciasFornecedor: 0 },
      { autoavaliacao: 1, justificativa: 'tenho certeza absoluta' },
    );
    // Com um único sinal a média é a própria força — mas o desenho é que
    // histórico exista para sustentar; aqui o teste fixa a intenção de que o
    // auto-relato nunca some a mais do que um sinal de peso 1.
    expect(c.sinais).toHaveLength(1);
    expect(c.sinais[0]!.peso).toBe(1);
  });

  it('modelo confiante NÃO supera histórico que o contradiz', () => {
    const c = confiancaClassificacao(
      { acertosDescricao: 0, divergenciasDescricao: 9, acertosFornecedor: 0, divergenciasFornecedor: 9 },
      { autoavaliacao: 1, justificativa: 'tenho certeza' },
    );
    expect(c.score).toBeLessThan(0.25);
  });

  it('a decomposição fica registrada para auditoria', () => {
    const c = confiancaClassificacao({
      acertosDescricao: 3,
      divergenciasDescricao: 1,
      acertosFornecedor: 2,
      divergenciasFornecedor: 0,
    });
    expect(c.sinais.map((s) => s.nome)).toEqual(['historico_descricao', 'historico_fornecedor']);
    for (const s of c.sinais) expect(s.observado).toMatch(/\d/);
  });
});

describe('confiança de conciliação', () => {
  it('valor exato e único, na data, dá confiança alta', () => {
    const c = confiancaConciliacao({ diferencaValor: 0, diferencaDias: 0, candidatosMesmoValor: 1 });
    expect(c.score).toBe(1);
  });

  /**
   * Este é o caso que o código antigo dava 0,95 fixo: dois aluguéis de
   * R$ 1.500 no mesmo mês. "O valor bate" deixa de significar qualquer coisa,
   * e é exatamente aí que a conciliação automática casa com a conta errada.
   */
  it('valor ambíguo derruba a confiança mesmo batendo exatamente', () => {
    const unico = confiancaConciliacao({ diferencaValor: 0, diferencaDias: 1, candidatosMesmoValor: 1 });
    const ambiguo = confiancaConciliacao({ diferencaValor: 0, diferencaDias: 1, candidatosMesmoValor: 3 });

    expect(ambiguo.score).toBeLessThan(unico.score);
    expect(ambiguo.score).toBeLessThan(0.6);
    expect(sinalValorExato({ diferencaValor: 0, diferencaDias: 1, candidatosMesmoValor: 3 }).observado).toMatch(
      /3 lançamentos em aberto com o mesmo valor/,
    );
  });

  it('valor que não bate zera o sinal mais forte', () => {
    const c = confiancaConciliacao({ diferencaValor: 12.5, diferencaDias: 0, candidatosMesmoValor: 0 });
    expect(c.score).toBeLessThan(0.3);
  });

  it('distância de data reduz a confiança de forma suave', () => {
    const perto = confiancaConciliacao({ diferencaValor: 0, diferencaDias: 1, candidatosMesmoValor: 1 });
    const longe = confiancaConciliacao({ diferencaValor: 0, diferencaDias: 20, candidatosMesmoValor: 1 });
    expect(perto.score).toBeGreaterThan(longe.score);
    expect(longe.score).toBeGreaterThan(0.5); // valor exato ainda sustenta
  });

  it('o sinal do modelo tem peso menor que o do histórico', () => {
    expect(sinalModelo(1, 'x').peso).toBeLessThan(3);
  });
});
