import { describe, it, expect } from 'vitest';
import { TaxThermometerService, rbt12Proporcional } from './tax-thermometer.service';

describe('simplesPosition — anexo apurado', () => {
  const svc = new TaxThermometerService();

  it('usa a tabela do anexo informado, mesmo com folha baixa', () => {
    // O caso real da BM3: RBT12 de R$ 85,6 mil, folha baixa, Anexo III
    // apurado. Deduzido pelo Fator R, daria Anexo V a 15,5%.
    const p = svc.simplesPosition({ rbt12: 85651.15, payroll12: 0, anexo: 'III' });
    expect(p.anexo).toBe('III');
    expect(p.nominalRate).toBe(6);
    expect(p.nextRate).toBe(11.2);
  });

  it('sem anexo informado, continua deduzindo pelo Fator R', () => {
    expect(svc.simplesPosition({ rbt12: 85651.15, payroll12: 0 }).anexo).toBe('V');
    expect(svc.simplesPosition({ rbt12: 100000, payroll12: 30000 }).anexo).toBe('III');
  });
});

describe('simplesPosition sem faturamento', () => {
  it('com pró-labore e sem faturamento, fica no Anexo III', () => {
    const p = new TaxThermometerService().simplesPosition({ rbt12: 0, payroll12: 60_000 });
    expect(p.anexo).toBe('III');
    expect(p.nominalRate).toBe(6);
  });
});

describe('Anexo IV e sublimite', () => {
  const svc = new TaxThermometerService();
  it('calcula pela tabela do Anexo IV', () => {
    // RBT12 R$ 500 mil no IV: (500.000 × 10,2% − 12.420) / 500.000 = 7,716%
    const p = svc.simplesPosition({ rbt12: 500_000, payroll12: 0, anexo: 'IV' });
    expect(p.nominalRate).toBe(10.2);
    expect(p.effectiveRate).toBeCloseTo(7.716, 3);
  });
  it('avisa o sublimite de R$ 3,6 milhões', () => {
    expect(svc.simplesPosition({ rbt12: 3_300_000, payroll12: 0, anexo: 'III' }).sublimite).toBe('PERTO');
    expect(svc.simplesPosition({ rbt12: 3_700_000, payroll12: 0, anexo: 'III' }).sublimite).toBe('ACIMA');
    expect(svc.simplesPosition({ rbt12: 1_000_000, payroll12: 0, anexo: 'III' }).sublimite).toBe('ABAIXO');
  });
});

describe('RBT12 de empresa com menos de 12 meses', () => {
  it('usa a média × 12', () => expect(rbt12Proporcional(30_000, 3, 0)).toBe(120_000));
  it('no primeiro mês, a receita do mês × 12', () => expect(rbt12Proporcional(0, 0, 8_000)).toBe(96_000));
  it('com 12 meses ou mais, a soma', () => expect(rbt12Proporcional(200_000, 12, 5_000)).toBe(200_000));
});
