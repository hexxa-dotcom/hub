import type { ReciboAluguelData } from './recibo-aluguel-pdf';
import { describe, it, expect } from 'vitest';
import { obterDadosReciboExemplo, obterDadosReciboPagamentoExemplo, gerarPdfReciboAluguel } from './recibo-aluguel';

describe('Recibo de Aluguel (Holding Patrimonial)', () => {
  it('gera os dados de exemplo com todas as informações requeridas', () => {
    const dados = obterDadosReciboExemplo();
    expect(dados.numeroRecibo).toContain('REC-');
    expect(dados.locador.nome).toContain('Participações');
    expect(dados.locatario.nome).toBeTruthy();
    expect(dados.imovel.label).toBeTruthy();
    expect(dados.valores.total).toBeGreaterThan(0);
    expect(dados.status).toBe('PAID');
  });

  it('renderiza o PDF do recibo em Buffer válido com cabeçalho PDF', async () => {
    const dados = {...obterDadosReciboExemplo(),urlVerificacao:'http://127.0.0.1:3001/previa/recibos/verificar'};
    const buffer = await gerarPdfReciboAluguel(dados);
    expect((buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const header = buffer.subarray(0, 5).toString('utf-8');
    expect(header).toBe('%PDF-');

    if (process.env.RECEIPT_PREVIEW_OUTPUT) {
      const fs = await import('node:fs/promises');
      await fs.mkdir(process.env.RECEIPT_PREVIEW_OUTPUT, { recursive: true });
      await fs.writeFile(`${process.env.RECEIPT_PREVIEW_OUTPUT}/recibo-holding.pdf`, buffer);
    }

  });

  it('renderiza a comprovação de pagamento com a nota vinculada', async () => {
    const dados = obterDadosReciboPagamentoExemplo();
    expect(dados.tipo).toBe('PAGAMENTO');
    expect(dados.notaFiscal).toBe('124');
    const buffer = await gerarPdfReciboAluguel(dados);
    expect(buffer.subarray(0,5).toString()).toBe('%PDF-');
    if (process.env.RECEIPT_PREVIEW_OUTPUT) {
      const fs = await import('node:fs/promises');
      await fs.mkdir(process.env.RECEIPT_PREVIEW_OUTPUT, { recursive: true });
      await fs.writeFile(`${process.env.RECEIPT_PREVIEW_OUTPUT}/recibo-pagamento.pdf`, buffer);
    }
  });
});

it('mantém oito itens, descrições longas e QR em uma página A4',async()=>{
 const data:ReciboAluguelData={...obterDadosReciboExemplo(),numeroRecibo:'REC-20260930-12ABCDEF5678',urlVerificacao:'https://hexxdigital.com.br/recibo/verificar/'+'a'.repeat(64),
 itens:Array.from({length:8},(_,i)=>({descricao:`Despesa ${i+1} — `+'Reembolso do período contratado '.repeat(2),valor:100})),valores:{aluguel:800,total:800}};
 data.assinatura={metodo:'HUB',nome:'Responsável da empresa — exemplo',em:'30/09/2026, 15:00:00',autorizacaoId:'demo',conteudoHash:'demo',exemplo:true};
 const buffer=await gerarPdfReciboAluguel(data);
 expect((buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1);
});
