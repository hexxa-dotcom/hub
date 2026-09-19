import { describe, it, expect } from 'vitest';
import {
  lerBalancete,
  separadorDe,
  celulasDaLinha,
  dataDoCabecalho,
  BalanceteIlegivelError,
} from './balancete-parser';

/**
 * O que estes testes protegem.
 *
 * Um balancete lido errado produz um balanço que FECHA e está errado — o pior
 * resultado possível, porque nada acusa. Os dois erros que produzem isso são
 * ler a coluna de saldo anterior no lugar da de saldo atual, e somar as linhas
 * de total junto com as contas. Cada um tem teste próprio abaixo.
 */

const CSV_PONTO_E_VIRGULA = `Balancete de Verificação - 01/01/2025 a 31/12/2025
Código;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual
1.1.01.001;Caixa Geral;500,00;12.000,00;10.500,00;2.000,00;D
1.1.02.001;Banco Conta Movimento;1.200,00;80.000,00;75.000,00;6.200,00;D
2.1.01.001;Fornecedores;0,00;5.000,00;9.200,00;4.200,00;C
2.3.01.001;Capital Social;4.000,00;0,00;0,00;4.000,00;C
TOTAL GERAL;;5.700,00;97.000,00;94.700,00;8.200,00;
`;

describe('separadorDe', () => {
  it('encontra o ponto-e-vírgula', () => {
    expect(separadorDe(CSV_PONTO_E_VIRGULA)).toBe(';');
  });

  it('não confunde a vírgula decimal com separador de coluna', () => {
    // Cada linha tem um número diferente de vírgulas — a marca de que elas
    // são decimais, não colunas. Foi esse o caso que motivou a checagem.
    const texto = [
      '1.1.01.001  Caixa  2.000,00',
      '1.1.02.001  Banco  6.200,00',
      '2.1.01.001  Fornecedores  4.200,00',
    ].join('\n');
    expect(separadorDe(texto)).toBeUndefined();
  });

  it('não cede à vírgula decimal quando há VÁRIAS colunas de valor por linha', () => {
    /**
     * A regressão que só apareceu contra um balancete de verdade.
     *
     * Com cinco colunas de valor, a vírgula decimal aparece cinco vezes em
     * quase toda linha: frequência alta e constante, o mesmo perfil de um
     * separador legítimo. A leitura seguia sem erro e devolvia sete contas
     * com saldo zero — que é pior do que falhar.
     */
    const texto = [
      'Conta   Descricao          Sld Anterior   Debito     Credito    Saldo Atual',
      '110001  CAIXA                    300,00  5.000,00   4.100,00      1.200,00 D',
      '110210  BANCO ITAU               2.500,00  88.000,00  82.300,00   8.200,00 D',
      '210100  FORNECEDORES               0,00  3.000,00   7.100,00      4.100,00 C',
      '240100  CAPITAL SOCIAL          4.300,00      0,00       0,00     4.300,00 C',
    ].join('\n');
    expect(separadorDe(texto)).toBeUndefined();
  });

  it('encontra a tabulação de planilha colada', () => {
    const texto = '1.1.01.001\tCaixa\t2.000,00\n1.1.02.001\tBanco\t6.200,00\n2.3\tCapital\t4.000,00';
    expect(separadorDe(texto)).toBe('\t');
  });
});

describe('celulasDaLinha', () => {
  it('divide por separador quando há um', () => {
    expect(celulasDaLinha('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });

  it('divide texto de PDF por dois ou mais espaços', () => {
    expect(celulasDaLinha('1.1.01.001   Caixa Geral    2.000,00  D')).toEqual([
      '1.1.01.001',
      'Caixa Geral',
      '2.000,00',
      'D',
    ]);
  });

  it('não quebra a descrição no espaço simples', () => {
    const c = celulasDaLinha('1.1.02.001    Banco Conta Movimento    6.200,00');
    expect(c[1]).toBe('Banco Conta Movimento');
  });

  it('tira as aspas do CSV', () => {
    expect(celulasDaLinha('"1.1";"Caixa, Geral";"2,00"', ';')).toEqual(['1.1', 'Caixa, Geral', '2,00']);
  });
});

describe('lerBalancete — CSV', () => {
  const r = lerBalancete(CSV_PONTO_E_VIRGULA);

  it('lê uma linha por conta analítica', () => {
    expect(r.linhas).toHaveLength(4);
  });

  it('pega o SALDO ATUAL, não o saldo anterior nem o movimento', () => {
    const caixa = r.linhas.find((l) => l.conta === '1.1.01.001')!;
    expect(caixa.valor).toBe(2000);
    // O saldo anterior era 500 e o débito do período 12.000: se qualquer um
    // deles vazasse para cá, o balanço fecharia errado.
    expect(caixa.valor).not.toBe(500);
    expect(caixa.valor).not.toBe(12000);
  });

  it('lê a descrição', () => {
    expect(r.linhas.find((l) => l.conta === '1.1.02.001')!.descricao).toBe('Banco Conta Movimento');
  });

  it('lê o lado marcado em coluna própria', () => {
    expect(r.linhas.find((l) => l.conta === '2.1.01.001')!.lado).toBe('C');
    expect(r.linhas.find((l) => l.conta === '1.1.01.001')!.lado).toBe('D');
  });

  it('descarta a linha de total', () => {
    expect(r.linhas.some((l) => /total/i.test(l.descricao))).toBe(false);
    expect(r.linhas.some((l) => l.valor === 8200)).toBe(false);
  });

  it('descarta o cabeçalho de colunas', () => {
    expect(r.linhas.some((l) => /descri/i.test(l.descricao))).toBe(false);
  });

  it('sabe dizer que o lado não foi deduzido', () => {
    expect(r.ladoExplicito).toBe(true);
  });

  it('fecha: débito igual a crédito', () => {
    const d = r.linhas.filter((l) => l.lado === 'D').reduce((t, l) => t + l.valor, 0);
    const c = r.linhas.filter((l) => l.lado === 'C').reduce((t, l) => t + l.valor, 0);
    expect(d).toBe(8200);
    expect(c).toBe(8200);
  });
});

describe('lerBalancete — texto de PDF', () => {
  const PDF = `
ESCRITORIO CONTABIL EXEMPLO LTDA
Balancete de Verificação
Período: 01/01/2025 a 31/12/2025

Conta          Descrição                     Saldo Atual
1.1.01.001     Caixa Geral                     2.000,00 D
1.1.02.001     Banco Conta Movimento           6.200,00 D
2.1.01.001     Fornecedores                    4.200,00 C
2.3.01.001     Capital Social                  4.000,00 C
               Total .........................  8.200,00
`;

  const r = lerBalancete(PDF);

  it('lê as quatro contas', () => {
    expect(r.linhas).toHaveLength(4);
  });

  it('separa o valor da marca colada nele', () => {
    const caixa = r.linhas[0]!;
    expect(caixa.valor).toBe(2000);
    expect(caixa.lado).toBe('D');
  });

  it('não trata o D de devedor como sinal negativo', () => {
    // `valorBr` lê `D` no fim como negativo, porque em extrato bancário é
    // isso que significa. Em balancete significa devedor, que é positivo.
    expect(r.linhas.every((l) => l.valor > 0)).toBe(true);
  });

  it('descarta a linha de total mesmo com pontilhado', () => {
    expect(r.linhas.some((l) => l.valor === 8200)).toBe(false);
  });

  it('pega a data de encerramento do cabeçalho', () => {
    expect(r.dataFinal).toBe('2025-12-31');
  });
});

describe('lerBalancete — balancete sem marca de lado', () => {
  const SEM_LADO = `1.1.01.001;Caixa;2.000,00
1.1.02.001;Banco;6.200,00
2.1.01.001;Fornecedores;-4.200,00
2.3.01.001;Capital Social;4.000,00`;

  const r = lerBalancete(SEM_LADO);

  it('avisa que o lado terá de ser deduzido', () => {
    expect(r.ladoExplicito).toBe(false);
  });

  it('preserva o sinal, que é a única pista de inversão que sobrou', () => {
    expect(r.linhas.find((l) => l.conta === '2.1.01.001')!.valor).toBe(-4200);
  });
});

describe('lerBalancete — recusas', () => {
  it('recusa um arquivo sem nenhuma conta, explicando o caso do PDF escaneado', () => {
    expect(() => lerBalancete('relatório vazio\nsem nada aqui')).toThrow(BalanceteIlegivelError);
    expect(() => lerBalancete('relatório vazio\nsem nada aqui')).toThrow(/escaneado|Excel/i);
  });

  it('recusa arquivo em branco', () => {
    expect(() => lerBalancete('')).toThrow(BalanceteIlegivelError);
  });
});

describe('dataDoCabecalho', () => {
  it('pega a ÚLTIMA data do período, que é o encerramento', () => {
    expect(dataDoCabecalho('Período: 01/01/2025 a 31/12/2025')).toBe('2025-12-31');
  });

  it('deduz o último dia quando só vem mês e ano', () => {
    expect(dataDoCabecalho('Balancete 02/2024')).toBe('2024-02-29');
  });

  it('devolve nulo quando não há data, em vez de inventar hoje', () => {
    expect(dataDoCabecalho('Balancete de Verificação')).toBeNull();
  });
});
