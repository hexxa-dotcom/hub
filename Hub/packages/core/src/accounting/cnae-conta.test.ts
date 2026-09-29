import { describe, it, expect } from 'vitest';
import { contaPorCnae } from './cnae-conta';

describe('contaPorCnae — casos reais do extrato da Gateway (ago/2026)', () => {
  it.each([
    ['4691500', '3.3.2.02.17', 'Komprão: atacado de alimentos → consumo/copa'],
    ['4729699', '3.3.2.02.17', 'ERV: varejo de alimentos → consumo/copa'],
    ['5611203', '3.3.2.02.16', 'Vitrine Gourmet: lanchonete → alimentação'],
    ['6201501', '3.3.2.02.15', 'M4: software sob encomenda → software'],
    ['1813099', '3.3.1.02.03', 'DigiPix: gráfica → material promocional'],
    ['5912099', '3.3.2.02.06', 'Jackson: pós-produção de vídeo → serviços'],
    ['7312200', '3.3.1.02.02', 'Facebook: publicidade'],
    ['8211300', '3.3.2.02.06', 'HEXX: apoio administrativo → serviços'],
  ])('%s → %s (%s)', (cnae, conta) => {
    expect(contaPorCnae(cnae)).toBe(conta);
  });

  it('a classe vence a divisão: posto de combustível não é "varejo em geral"', () => {
    expect(contaPorCnae('4731800')).toBe('3.3.2.02.19');
    expect(contaPorCnae('4711302')).toBe('3.3.2.02.17');
  });

  it('CNAE ambíguo ou vazio não vira regra', () => {
    expect(contaPorCnae('6619302')).toBeNull(); // intermediador de pagamento
    expect(contaPorCnae('8411600')).toBeNull(); // administração pública
    expect(contaPorCnae('8630503')).toBeNull(); // clínica
    expect(contaPorCnae(null)).toBeNull();
    expect(contaPorCnae('62')).toBeNull();
  });
});
