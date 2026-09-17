import { describe, it, expect } from 'vitest';
import { validarSugestoes, type CategoriaDisponivel, type LancamentoPendente } from './classificacao-guards';

const pendentes: LancamentoPendente[] = [
  { id: 'l1', tipo: 'PAYABLE' },
  { id: 'l2', tipo: 'RECEIVABLE' },
  { id: 'l3', tipo: 'PAYABLE' },
];

const categorias: CategoriaDisponivel[] = [
  { id: 'c-desp', nome: 'Software e Assinaturas', tipo: 'EXPENSE' },
  { id: 'c-rec', nome: 'Serviços Prestados', tipo: 'INCOME' },
];

describe('travas da classificação por IA', () => {
  it('aceita sugestão coerente', () => {
    const r = validarSugestoes(
      [{ id: 'l1', categoria_id: 'c-desp', justificativa: 'Assinatura mensal.', confianca: 0.9 }],
      pendentes,
      categorias,
    );
    expect(r.aceitas).toHaveLength(1);
    expect(r.aceitas[0]!.categoriaNome).toBe('Software e Assinaturas');
    expect(r.aceitas[0]!.autoavaliacao).toBe(0.9);
  });

  /**
   * O erro mais provável de um LLM classificador: devolver um id plausível que
   * não existe. Descartar é a única resposta segura — "corrigir" para a
   * categoria mais parecida transformaria alucinação em lançamento contábil.
   */
  it('descarta categoria que não existe no plano — não tenta corrigir', () => {
    const r = validarSugestoes(
      [{ id: 'l1', categoria_id: 'c-inventada', justificativa: 'x' }],
      pendentes,
      categorias,
    );
    expect(r.aceitas).toHaveLength(0);
    expect(r.descartados.find((d) => d.id === 'l1')!.motivo).toMatch(/não existe no plano/);
  });

  /**
   * Despesa com categoria de receita: o razão aceitaria sem reclamar, porque a
   * partida fecha do mesmo jeito. O erro só apareceria na DRE, meses depois.
   */
  it('descarta despesa classificada como receita', () => {
    const r = validarSugestoes([{ id: 'l1', categoria_id: 'c-rec' }], pendentes, categorias);
    expect(r.aceitas).toHaveLength(0);
    expect(r.descartados[0]!.motivo).toMatch(/é INCOME, mas o lançamento é PAYABLE/);
  });

  it('descarta receita classificada como despesa', () => {
    const r = validarSugestoes([{ id: 'l2', categoria_id: 'c-desp' }], pendentes, categorias);
    expect(r.aceitas).toHaveLength(0);
  });

  it('descarta id de lançamento que não estava no lote', () => {
    const r = validarSugestoes([{ id: 'fantasma', categoria_id: 'c-desp' }], pendentes, categorias);
    expect(r.aceitas).toHaveLength(0);
    expect(r.descartados.find((d) => d.id === 'fantasma')).toBeTruthy();
  });

  /** Duas categorias para o mesmo lançamento é contradição, não alternativa. */
  it('aceita a primeira e descarta a contradição', () => {
    const r = validarSugestoes(
      [
        { id: 'l1', categoria_id: 'c-desp' },
        { id: 'l1', categoria_id: 'c-desp' },
      ],
      pendentes,
      categorias,
    );
    expect(r.aceitas).toHaveLength(1);
    expect(r.descartados.find((d) => d.motivo.includes('duas categorias'))).toBeTruthy();
  });

  it('confiança fora da faixa vira 0,5 — nem endossa nem pune', () => {
    for (const c of [1.5, -1, Number.NaN]) {
      const r = validarSugestoes([{ id: 'l1', categoria_id: 'c-desp', confianca: c }], pendentes, categorias);
      expect(r.aceitas[0]!.autoavaliacao).toBe(0.5);
    }
  });

  it('lançamento omitido pelo modelo é registrado, não ignorado', () => {
    const r = validarSugestoes([{ id: 'l1', categoria_id: 'c-desp' }], pendentes, categorias);
    expect(r.aceitas).toHaveLength(1);
    const omitidos = r.descartados.filter((d) => d.motivo.includes('não teve segurança'));
    expect(omitidos.map((o) => o.id).sort()).toEqual(['l2', 'l3']);
  });

  it('lote inteiro inválido não produz nenhuma classificação', () => {
    const r = validarSugestoes(
      [
        { id: 'l1', categoria_id: 'nope' },
        { id: 'l2', categoria_id: 'c-desp' },
        { id: 'l3', categoria_id: 'c-rec' },
      ],
      pendentes,
      categorias,
    );
    expect(r.aceitas).toHaveLength(0);
    expect(r.descartados).toHaveLength(3);
  });

  it('justificativa vazia ganha um texto mínimo, nunca fica em branco', () => {
    const r = validarSugestoes(
      [{ id: 'l1', categoria_id: 'c-desp', justificativa: '   ' }],
      pendentes,
      categorias,
    );
    expect(r.aceitas[0]!.justificativa).toMatch(/Software/);
  });
});
