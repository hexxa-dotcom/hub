import { describe, it, expect } from 'vitest';
import { TaxThermometerService } from './tax-thermometer.service';

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
