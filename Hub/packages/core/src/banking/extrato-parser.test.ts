import { describe, it, expect } from 'vitest';
import {
  lerExtrato, lerOfx, lerCsv, valorBr, dataBr, dividirCsv, ExtratoIlegivelError,
} from './extrato-parser';

/**
 * Os casos aqui são os formatos que os bancos brasileiros realmente entregam.
 * Extrato mal lido não dá erro: dá um número plausível e errado, que aparece
 * meses depois quando o saldo não bate.
 */

describe('valorBr', () => {
  it('lê o padrão brasileiro', () => {
    expect(valorBr('1.234,56')).toBe(1234.56);
    expect(valorBr('R$ 1.234,56')).toBe(1234.56);
    expect(valorBr('-1.234,56')).toBe(-1234.56);
    expect(valorBr('0,01')).toBe(0.01);
  });

  it('lê o padrão americano, que alguns exportadores usam', () => {
    expect(valorBr('1234.56')).toBe(1234.56);
    expect(valorBr('1,234.56')).toBe(1234.56);
  });

  it('entende os marcadores de débito', () => {
    expect(valorBr('(1.234,56)')).toBe(-1234.56);
    expect(valorBr('1.234,56 D')).toBe(-1234.56);
    expect(valorBr('1.234,56 C')).toBe(1234.56);
  });

  it('devolve null quando não há número', () => {
    expect(valorBr('')).toBeNull();
    expect(valorBr('SALDO')).toBeNull();
  });

  /**
   * O caso que separa uma leitura correta de uma catástrofe silenciosa:
   * `1.234` é mil duzentos e trinta e quatro no Brasil. Lido como americano
   * viraria 1,234 — um erro de mil vezes que fecha a partida e some no meio
   * de centenas de linhas.
   */
  it('trata milhar sem centavos como brasileiro', () => {
    expect(valorBr('1.234,00')).toBe(1234);
    expect(valorBr('10.000,00')).toBe(10000);
  });
});

describe('dataBr', () => {
  it('aceita os formatos usados nos extratos', () => {
    expect(dataBr('05/03/2026')).toBe('2026-03-05');
    expect(dataBr('05-03-2026')).toBe('2026-03-05');
    expect(dataBr('2026-03-05')).toBe('2026-03-05');
    expect(dataBr('20260305')).toBe('2026-03-05');
    expect(dataBr('20260305120000[-3:BRT]')).toBe('2026-03-05');
  });

  it('expande ano de dois dígitos', () => {
    expect(dataBr('05/03/26')).toBe('2026-03-05');
  });

  it('devolve null no que não é data', () => {
    expect(dataBr('TOTAL')).toBeNull();
    expect(dataBr('')).toBeNull();
  });
});

describe('dividirCsv', () => {
  it('respeita aspas e separador dentro do campo', () => {
    expect(dividirCsv('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
  });

  it('entende aspas escapadas', () => {
    expect(dividirCsv('a;"diz ""oi""";c', ';')).toEqual(['a', 'diz "oi"', 'c']);
  });
});

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260305120000[-3:BRT]<TRNAMT>-485.00
<FITID>2026030500001<NAME>NIBO TECNOLOGIA<MEMO>PAGAMENTO PIX</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260310120000[-3:BRT]<TRNAMT>12500.00
<FITID>2026031000002<NAME>RECEBIMENTO CLIENTE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260320120000[-3:BRT]<TRNAMT>-447.79
<FITID>2026032000003<MEMO>DAS SIMPLES NACIONAL</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('lerOfx', () => {
  it('lê as transações com sinal, data e identificador', () => {
    const r = lerOfx(OFX);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]).toEqual({
      data: '2026-03-05',
      valor: -485,
      descricao: 'NIBO TECNOLOGIA — PAGAMENTO PIX',
      idExterno: '2026030500001',
    });
    expect(r.linhas[1]!.valor).toBe(12500);
    expect(r.linhas[2]!.descricao).toBe('DAS SIMPLES NACIONAL');
  });

  it('traz banco, conta e período', () => {
    const r = lerOfx(OFX);
    expect(r.banco).toBe('341');
    expect(r.conta).toBe('12345-6');
    expect(r.de).toBe('2026-03-05');
    expect(r.ate).toBe('2026-03-20');
  });

  it('recusa arquivo sem transação, em vez de devolver lista vazia', () => {
    expect(() => lerOfx('<OFX></OFX>')).toThrow(ExtratoIlegivelError);
  });
});

const CSV = `Extrato Conta Corrente
Empresa: HEXX SERVICOS DIGITAIS LTDA
Periodo: 01/03/2026 a 31/03/2026

Data;Histórico;Documento;Valor
05/03/2026;PAGAMENTO PIX NIBO;PIX001;-485,00
10/03/2026;TED RECEBIDA CLIENTE;TED77;12.500,00
20/03/2026;DAS SIMPLES NACIONAL;DAS01;-447,79
;SALDO FINAL;;11.567,21`;

describe('lerCsv', () => {
  it('encontra o cabeçalho depois das linhas de enfeite', () => {
    const r = lerCsv(CSV);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]!.descricao).toBe('PAGAMENTO PIX NIBO');
    expect(r.linhas[0]!.valor).toBe(-485);
    expect(r.linhas[1]!.valor).toBe(12500);
  });

  it('ignora o rodapé de saldo sem tratá-lo como transação', () => {
    const r = lerCsv(CSV);
    expect(r.linhas.map((l) => l.descricao)).not.toContain('SALDO FINAL');
    expect(r.ignoradas.some((i) => i.linha.includes('SALDO FINAL'))).toBe(true);
  });

  it('soma colunas separadas de crédito e débito', () => {
    const r = lerCsv(
      `Data;Historico;Credito;Debito
05/03/2026;PAGAMENTO;;485,00
10/03/2026;RECEBIMENTO;12.500,00;`,
    );
    expect(r.linhas[0]!.valor).toBe(-485);
    expect(r.linhas[1]!.valor).toBe(12500);
  });

  it('aceita vírgula como separador', () => {
    const r = lerCsv(`Data,Historico,Valor\n05/03/2026,PAGAMENTO,-485.00`);
    expect(r.linhas[0]!.valor).toBe(-485);
  });

  it('explica o que fazer quando não acha o cabeçalho', () => {
    expect(() => lerCsv('linha solta\noutra linha')).toThrow(/cabeçalho/);
  });
});

describe('lerExtrato', () => {
  it('escolhe o leitor pelo conteúdo, não pela extensão', () => {
    expect(lerExtrato(OFX).linhas).toHaveLength(3);
    expect(lerExtrato(CSV).linhas).toHaveLength(3);
  });

  /**
   * Os dois formatos do MESMO extrato têm que produzir os mesmos valores.
   * É a verificação que pega erro de sinal e de separador decimal de uma vez.
   */
  it('lê o mesmo extrato igual em OFX e em CSV', () => {
    const a = lerExtrato(OFX).linhas.map((l) => [l.data, l.valor]);
    const b = lerExtrato(CSV).linhas.map((l) => [l.data, l.valor]);
    expect(a).toEqual(b);
  });
});
