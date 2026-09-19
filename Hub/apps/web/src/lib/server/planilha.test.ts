import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { lerBalancete } from '@hexxa/core';
import { planilhaParaTexto, PlanilhaIlegivelError } from './planilha';

/**
 * Uma planilha de verdade, montada byte a byte.
 *
 * Os casos que ela carrega são os que quebram leitura de balancete:
 * código de conta guardado como NÚMERO (igual ao valor, no Excel), valor
 * inteiro sem centavos, célula vazia no meio da linha, texto em runs
 * formatados, e a linha de total.
 */
function montarXlsx(): Uint8Array {
  const shared = [
    'Conta', 'Descrição', 'Saldo anterior', 'Saldo atual', '', // 0-4
    'Caixa Geral', 'D', 'Fornecedores', 'C', 'Capital Social', 'TOTAL', // 5-10
  ];
  const si = shared
    .map((t, i) =>
      // A descrição "Fornecedores" vem em dois runs, como o Excel grava
      // texto com parte em negrito.
      i === 7
        ? '<si><r><t>Fornece</t></r><r><rPr><b/></rPr><t>dores</t></r></si>'
        : `<si><t>${t}</t></si>`,
    )
    .join('');

  // s="0" = Geral; s="1" = numFmtId 4 (#,##0.00).
  const linha = (n: number, cells: string) => `<row r="${n}">${cells}</row>`;
  const s = (ref: string, idx: number) => `<c r="${ref}" t="s"><v>${idx}</v></c>`;
  const num = (ref: string, v: number, estilo: 0 | 1) => `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;

  const rows = [
    linha(1, s('A1', 0) + s('B1', 1) + s('C1', 2) + s('D1', 3)),
    // Código como número (Geral), valor inteiro formatado com decimais.
    linha(2, num('A2', 110001, 0) + s('B2', 5) + num('C2', 500, 1) + num('D2', 2000, 1) + s('E2', 6)),
    // Célula C vazia (omitida): o saldo não pode escorregar para a coluna C.
    linha(3, num('A3', 210100, 0) + s('B3', 7) + num('D3', 850.5, 1) + s('E3', 8)),
    linha(4, num('A4', 240100, 0) + s('B4', 9) + num('C4', 1149.5, 1) + num('D4', 1149.5, 1) + s('E4', 8)),
    linha(5, s('A5', 10) + num('D5', 4000, 1)),
  ].join('');

  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="r"><sheets><sheet name="Balancete" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(`<sst>${si}</sst>`),
    'xl/styles.xml': strToU8(
      '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="4"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows}</sheetData></worksheet>`),
  });
}

describe('planilhaParaTexto', () => {
  const texto = planilhaParaTexto(montarXlsx());
  const linhas = texto.split('\n');

  it('mantém o código de conta cru, sem virar valor', () => {
    expect(linhas[1]!.split('\t')[0]).toBe('110001');
  });

  it('formata o valor em padrão brasileiro, mesmo inteiro', () => {
    // 2000 formatado com decimais: sem isto seria indistinguível de um código.
    expect(linhas[1]!.split('\t')[3]).toBe('2.000,00');
  });

  it('preserva a posição quando o Excel omite a célula vazia', () => {
    const c = linhas[2]!.split('\t');
    expect(c[2]).toBe('');
    expect(c[3]).toBe('850,50');
  });

  it('junta texto gravado em runs formatados', () => {
    expect(linhas[2]!.split('\t')[1]).toBe('Fornecedores');
  });
});

describe('planilha → lerBalancete, ponta a ponta', () => {
  const r = lerBalancete(planilhaParaTexto(montarXlsx()));

  it('lê as três contas e descarta cabeçalho e total', () => {
    expect(r.linhas.map((l) => l.conta)).toEqual(['110001', '210100', '240100']);
  });

  it('pega o saldo atual, com o lado', () => {
    const caixa = r.linhas.find((l) => l.conta === '110001')!;
    expect(caixa.valor).toBe(2000);
    expect(caixa.lado).toBe('D');
  });

  it('fecha: débito igual a crédito', () => {
    const d = r.linhas.filter((l) => l.lado === 'D').reduce((t, l) => t + l.valor, 0);
    const c = r.linhas.filter((l) => l.lado === 'C').reduce((t, l) => t + l.valor, 0);
    expect(d).toBe(2000);
    expect(c).toBe(2000);
  });
});

describe('recusas', () => {
  it('recusa o que não é zip, explicando o caso do .xls', () => {
    expect(() => planilhaParaTexto(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(PlanilhaIlegivelError);
    expect(() => planilhaParaTexto(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(/\.xls/);
  });
});
