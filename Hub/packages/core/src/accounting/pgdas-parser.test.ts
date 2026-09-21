import { describe, it, expect } from 'vitest';
import { lerExtratoPgdas } from './pgdas-parser';

/** Texto no formato que o pdf-parse devolve de um extrato do PGDAS-D. */
const EXTRATO = `
Extrato do Simples Nacional
PGDAS-D 2018
CNPJ Matriz: 62.414.421/0001-16
Período de Apuração (PA): 08/2026
Data/Hora da Transmissão: 15/09/2026

Receita Bruta do PA (RPA) - Competência   18.400,00
Receita Bruta Acumulada nos 12 meses anteriores (RBT12)   214.800,00

Anexo III - Receitas de locação de bens móveis e de prestação de serviços
Alíquota Efetiva   6,54 %
Valor Total do Débito   1.203,36
`;

describe('lerExtratoPgdas', () => {
  it('extrai o RBT12, que é o número que decide a faixa', () => {
    const r = lerExtratoPgdas(EXTRATO);
    expect(r.ok).toBe(true);
    expect(r.extrato!.rbt12).toBe(214800);
  });

  it('extrai alíquota, anexo, competência e receita do período', () => {
    const e = lerExtratoPgdas(EXTRATO).extrato!;
    expect(e.aliquotaEfetiva).toBe(6.54);
    expect(e.anexo).toBe('Anexo III');
    expect(e.competencia).toBe('2026-08');
    expect(e.receitaDoPeriodo).toBe(18400);
  });

  it('aceita "RBT12" e "RBA12" — o extrato mudou de layout', () => {
    const comRba = EXTRATO.replace('(RBT12)', '(RBA12)');
    expect(lerExtratoPgdas(comRba).extrato!.rbt12).toBe(214800);
  });

  it('recusa arquivo que não é PGDAS, em vez de ler lixo', () => {
    const r = lerExtratoPgdas('Contrato de prestação de serviços. Valor: 1.000,00');
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/não parece/i);
  });

  it('sem RBT12 ele falha — não assume zero', () => {
    // Zero jogaria a empresa na primeira faixa e mostraria uma alíquota que
    // não é a dela.
    const semRbt = EXTRATO.replace(/Receita Bruta Acumulada.*/, '');
    const r = lerExtratoPgdas(semRbt);
    expect(r.ok).toBe(false);
    expect(r.extrato).toBeNull();
  });

  it('campo opcional ausente vira null, e o RBT12 ainda vale', () => {
    const semAliquota = EXTRATO.replace(/Alíquota Efetiva.*/, '');
    const r = lerExtratoPgdas(semAliquota);
    expect(r.ok).toBe(true);
    expect(r.extrato!.aliquotaEfetiva).toBeNull();
    expect(r.extrato!.rbt12).toBe(214800);
  });

  it('lê valor com milhar e sem milhar', () => {
    const pequeno = EXTRATO.replace('214.800,00', '9.500,00');
    expect(lerExtratoPgdas(pequeno).extrato!.rbt12).toBe(9500);
    const semMilhar = EXTRATO.replace('214.800,00', '800,00');
    expect(lerExtratoPgdas(semMilhar).extrato!.rbt12).toBe(800);
  });

  it('reconhece os anexos de um algarismo e de dois', () => {
    expect(lerExtratoPgdas(EXTRATO.replace('Anexo III', 'Anexo V')).extrato!.anexo).toBe('Anexo V');
    expect(lerExtratoPgdas(EXTRATO.replace('Anexo III', 'Anexo IV')).extrato!.anexo).toBe('Anexo IV');
  });
});
