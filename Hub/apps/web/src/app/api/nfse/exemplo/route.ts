import { NextResponse } from 'next/server';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { renderDanfsePdf } from '@/lib/server/danfse-pdf';
import type { DanfseData } from '@/lib/server/danfse';

export const dynamic = 'force-dynamic';

/**
 * A NOTA DE EXEMPLO — a DANFSe com o prestador de verdade (a empresa) e um
 * tomador fictício, com a faixa "NOTA DE EXEMPLO — SEM VALOR FISCAL". Serve
 * para ver o layout completo, com IBS/CBS e informações complementares, sem
 * precisar emitir nada.
 */
export async function GET() {
  const ctx = await getTenantContext();
  const [e] = (await getDb().execute(sql`
    SELECT coalesce(n.razao_social, c.legal_name) AS nome, coalesce(n.cnpj, c.cnpj) AS cnpj, c.city AS cidade, c.state AS uf,
           coalesce(n.logradouro, c.address_line1) AS logradouro, coalesce(n.numero, c.address_number) AS numero,
           coalesce(n.bairro, c.neighborhood) AS bairro, coalesce(n.cep, c.zipcode) AS cep
      FROM company c LEFT JOIN nfse_config n ON n.company_id = c.id WHERE c.id = ${ctx.companyId}
  `)) as unknown as { nome: string; cnpj: string; cidade: string | null; uf: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cep: string | null }[];

  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const municipio = e?.cidade ? `${e.cidade} / ${e.uf ?? ''}` : 'Município da empresa';
  const valor = 2500;
  const data: DanfseData = {
    homologacao: false,
    exemplo: true,
    chaveAcesso: '00000000000000000000000000000000000000000000000000',
    numero: 'EXEMPLO',
    dataEmissao: agora,
    competencia: hoje,
    codigoTributacaoNacional: '17.02.02',
    descricaoTributacaoNacional: 'Expediente, secretaria em geral, apoio e infra-estrutura administrativa e congêneres.',
    localPrestacao: municipio,
    prestador: {
      documento: (e?.cnpj ?? '').replace(/\D/g, ''),
      nome: e?.nome ?? 'Sua empresa',
      municipio,
      regime: 'SIMPLES_NACIONAL',
      endereco: e?.logradouro ? { logradouro: e.logradouro, numero: e.numero ?? '', complemento: '', bairro: e.bairro ?? '', cep: e.cep ?? '' } : null,
    },
    tomador: {
      documento: '11222333000181',
      nome: 'CLIENTE EXEMPLO LTDA',
      email: 'financeiro@clienteexemplo.com.br',
      telefone: '(47) 99999-0000',
      endereco: { logradouro: 'Avenida Exemplo', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cep: '88370000' },
    },
    descricaoServico: 'Consultoria em gestão financeira e apoio administrativo referente ao mês.',
    informacoesComplementares: 'Pedido 1234 · Pagamento por PIX (chave: CNPJ do prestador) · Vencimento em 10 dias.',
    issRetido: false,
    valores: { valorServico: valor, baseCalculo: valor, aliquotaIss: 0, valorIss: 0, valorLiquido: valor, tributosAproximados: valor * 0.06 },
    // Como ficará o bloco da reforma (2026 = alíquotas de teste, só informativas).
    ibsCbs: {
      cst: '000',
      classTrib: '000001',
      indicadorOperacao: '100301',
      localIncidencia: 'Domicílio do adquirente',
      aliquotaIbsUf: 0.1,
      aliquotaEfetivaIbsUf: 0.1,
      valorIbsUf: valor * 0.001,
      aliquotaIbsMun: 0,
      aliquotaEfetivaIbsMun: 0,
      valorIbsMun: 0,
      valorIbsTotal: valor * 0.001,
      aliquotaCbs: 0.9,
      aliquotaEfetivaCbs: 0.9,
      valorCbs: valor * 0.009,
    },
  };
  const pdf = await renderDanfsePdf(data);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="nota-de-exemplo.pdf"', 'Cache-Control': 'no-store' },
  });
}
