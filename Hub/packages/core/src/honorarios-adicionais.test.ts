import { describe, it, expect } from 'vitest';
import { calcularAdicionais, descricaoDosAdicionais } from './honorarios-adicionais';

const base = {
  colaboradores: 0,
  socios: 1,
  sociosInclusos: 2,
  admissoes: 0,
  valorPorColaborador: 50,
  valorPorEvento: 150,
};

describe('calcularAdicionais', () => {
  it('o profissional sozinho não paga adicional nenhum', () => {
    const r = calcularAdicionais(base);
    expect(r.total).toBe(0);
    expect(r.itens).toEqual([]);
  });

  it('cobra por colaborador desde o primeiro', () => {
    const r = calcularAdicionais({ ...base, colaboradores: 3 });
    expect(r.total).toBe(150);
    expect(r.itens[0]!.descricao).toBe('colaboradores');
  });

  it('dois sócios estão inclusos; o terceiro custa', () => {
    expect(calcularAdicionais({ ...base, socios: 2 }).total).toBe(0);
    const r = calcularAdicionais({ ...base, socios: 3 });
    expect(r.total).toBe(50);
    expect(r.itens[0]!.descricao).toBe('sócio adicional');
  });

  it('admissão é evento, cobrado uma vez', () => {
    const r = calcularAdicionais({ ...base, admissoes: 2 });
    expect(r.total).toBe(300);
  });

  it('soma tudo e mantém os itens separados na fatura', () => {
    const r = calcularAdicionais({ ...base, colaboradores: 2, socios: 3, admissoes: 1 });
    expect(r.total).toBe(100 + 50 + 150);
    expect(r.itens).toHaveLength(3);
  });

  it('singular e plural saem certos', () => {
    expect(calcularAdicionais({ ...base, colaboradores: 1 }).itens[0]!.descricao).toBe('colaborador');
    expect(descricaoDosAdicionais(calcularAdicionais({ ...base, colaboradores: 1 }))).toContain(
      '1 colaborador ×',
    );
  });

  it('plano sem adicional configurado não cobra nada', () => {
    const r = calcularAdicionais({
      ...base,
      colaboradores: 5,
      admissoes: 2,
      valorPorColaborador: 0,
      valorPorEvento: 0,
    });
    expect(r.total).toBe(0);
  });
});
