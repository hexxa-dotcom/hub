import { validarDiscriminacao } from '@/lib/recibo-rules';
import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import {
  obterDadosReciboAluguel,
  obterDadosReciboExemplo,
  obterDadosReciboPagamentoExemplo,
  gerarPdfReciboAluguel,
} from '@/lib/server/recibo-aluguel';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exemplo = searchParams.get('exemplo') === 'true';
  const id = searchParams.get('id');

  try {
    let dados;
    if (exemplo) {
      if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Prévia indisponível.' }, { status: 404 });
      dados = searchParams.get('tipo') === 'pagamento' ? obterDadosReciboPagamentoExemplo() : obterDadosReciboExemplo();
      // Fictitious preview rows can be emitted in memory. Keep their PDF in
      // sync with the visible row without writing to the connected database.
      const number = searchParams.get('numero');
      const amount = Number(searchParams.get('valor'));
      if (number && /^REC-[A-Z0-9-]{1,60}$/.test(number) && Number.isFinite(amount) && amount > 0 && amount < 1e12) {
        dados = { ...dados, numeroRecibo:number, codigoVerificacao:number,
          descricao:searchParams.get('descricao')?.slice(0,500) || dados.descricao,
          mesReferencia:searchParams.get('mes')?.slice(0,50) || dados.mesReferencia,
          dataPagamento:searchParams.get('pagamento')?.slice(0,10) || dados.dataPagamento,
          notaFiscal:searchParams.get('nota')?.slice(0,60) || null,
          locatario: { ...dados.locatario, nome:searchParams.get('pagador')?.slice(0,200) || dados.locatario.nome },
          valores: { aluguel:amount, total:amount }, dadosPagamento:undefined,
          imovel:{ ...dados.imovel,label:searchParams.get('descricao')?.slice(0,500) || dados.imovel.label },
        };
      }
      const items=searchParams.get('itens');
      if(items && items!=='[]') dados.itens=validarDiscriminacao(JSON.parse(items),dados.valores.total);
      if(searchParams.get('assinado')==='true') dados.assinatura={metodo:'HUB',nome:'Filipe Heck — exemplo',em:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),autorizacaoId:'previa',conteudoHash:'previa',exemplo:true};
      const verify=new URL('/previa/recibos/verificar',request.url);
      verify.search=new URLSearchParams({numero:dados.numeroRecibo,emissor:dados.locador.nome,mes:dados.mesReferencia,valor:String(dados.valores.total),pagamento:dados.dataPagamento || '',...(dados.assinatura ? {assinante:dados.assinatura.nome,assinaturaEm:dados.assinatura.em} : {})}).toString();
      dados.urlVerificacao=verify.href;
    } else {
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Informe um recebimento válido.' }, { status: 400 });
      const ctx = await getTenantContext();
      dados = await obterDadosReciboAluguel(ctx, id);
      if (!dados) {
        return NextResponse.json({ error: 'Lançamento ou aluguel não encontrado.' }, { status: 404 });
      }
    }

    const buffer = await gerarPdfReciboAluguel(dados);
    const filename = `Recibo_${dados.numeroRecibo}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${searchParams.get('download') === 'true' ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    console.error('Erro ao gerar prévia do recibo de aluguel:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar PDF do recibo.' },
      { status: 500 },
    );
  }
}
