import 'server-only';
import { getDb, sql } from '@hexxa/db';
import { renderDanfsePdf } from './danfse-pdf';
import type { DanfseData } from './danfse';

/**
 * A NOTA DE EXEMPLO — a DANFSe com o prestador de verdade (a empresa) e um
 * tomador fictício, com a faixa "NOTA DE EXEMPLO — SEM VALOR FISCAL". Serve
 * para ver o layout completo, com IBS/CBS e informações complementares, sem
 * precisar emitir nada.
 */
export async function danfseDeExemplo(companyId: string): Promise<Buffer> {
  const [e] = (await getDb().execute(sql`
    SELECT coalesce(n.razao_social, c.legal_name) AS nome, coalesce(n.cnpj, c.cnpj) AS cnpj, c.city AS cidade, c.state AS uf,
           coalesce(n.logradouro, c.address_line1) AS logradouro, coalesce(n.numero, c.address_number) AS numero,
           coalesce(n.bairro, c.neighborhood) AS bairro, coalesce(n.cep, c.zipcode) AS cep
      FROM company c LEFT JOIN nfse_config n ON n.company_id = c.id WHERE c.id = ${companyId}
  `)) as unknown as {
    nome: string;
    cnpj: string;
    cidade: string | null;
    uf: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cep: string | null;
  }[];

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
  return renderDanfsePdf(data);
}

// ── Prévia: a nota como vai sair, antes de emitir (ou a agendada) ──────────

export interface PedidoDePrevia {
  tomador: {
    nome: string;
    documento: string;
    email?: string;
    telefone?: string;
    endereco?: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; municipio?: string; uf?: string } | null;
  };
  descricao: string;
  valor: number;
  informacoes?: string;
  /** 'AAAA-MM-DD' */
  competencia: string;
  perfilId?: string | null;
  /** % estimado de tributos (a régua da Bússola) — vira os tributos aproximados. */
  taxa?: number;
  reterIss?: boolean;
  agendadaPara?: string;
}

/**
 * A DANFSe de uma nota que ainda não existe — o mesmo layout da nota de
 * verdade, com a faixa "PRÉVIA". Número, chave e data de emissão ficam em
 * branco: só a emissão cria esses dados.
 */
export async function danfseDePrevia(companyId: string, p: PedidoDePrevia): Promise<Buffer> {
  const db = getDb();
  const [e] = (await db.execute(sql`
    SELECT coalesce(n.razao_social, c.legal_name) AS nome, coalesce(n.cnpj, c.cnpj) AS cnpj, c.city AS cidade, c.state AS uf, c.tax_regime AS regime,
           coalesce(n.logradouro, c.address_line1) AS logradouro, coalesce(n.numero, c.address_number) AS numero,
           coalesce(n.bairro, c.neighborhood) AS bairro, coalesce(n.cep, c.zipcode) AS cep
      FROM company c LEFT JOIN nfse_config n ON n.company_id = c.id WHERE c.id = ${companyId}
  `)) as unknown as {
    nome: string;
    cnpj: string;
    cidade: string | null;
    uf: string | null;
    regime: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cep: string | null;
  }[];
  const [perfil] = (await db
    .execute(
      sql`
    SELECT nome, item_lista_servico AS item FROM nfse_service_profile
     WHERE company_id = ${companyId} AND (${p.perfilId ?? null}::uuid IS NULL OR id = ${p.perfilId ?? null}::uuid)
     ORDER BY created_at LIMIT 1
  `,
    )
    .catch(() => [])) as unknown as { nome: string; item: string }[];

  const municipio = e?.cidade ? `${e.cidade} / ${e.uf ?? ''}` : '—';
  const item = (perfil?.item ?? '').replace(/\D/g, '').padEnd(6, '0');
  const t = p.tomador;
  const data: DanfseData = {
    homologacao: false,
    previa: { agendadaPara: p.agendadaPara ? p.agendadaPara.split('-').reverse().join('/') : undefined },
    chaveAcesso: '—',
    numero: '—',
    dataEmissao: '—',
    competencia: p.competencia.split('-').reverse().join('/'),
    codigoTributacaoNacional: perfil ? `${item.slice(0, 2)}.${item.slice(2, 4)}.${item.slice(4, 6)}` : '—',
    descricaoTributacaoNacional: perfil?.nome ?? '—',
    localPrestacao: municipio,
    prestador: {
      documento: (e?.cnpj ?? '').replace(/\D/g, ''),
      nome: e?.nome ?? '—',
      municipio,
      regime: e?.regime === 'SIMPLES_NACIONAL' ? 'SIMPLES_NACIONAL' : e?.regime === 'MEI' ? 'MEI' : 'NAO_OPTANTE',
      endereco: e?.logradouro ? { logradouro: e.logradouro, numero: e.numero ?? '', complemento: '', bairro: e.bairro ?? '', cep: e.cep ?? '' } : null,
    },
    tomador: {
      documento: t.documento.replace(/\D/g, ''),
      nome: t.nome,
      email: t.email ?? '',
      telefone: t.telefone ?? '',
      endereco: t.endereco
        ? {
            logradouro: t.endereco.logradouro,
            numero: t.endereco.numero,
            complemento: t.endereco.complemento ?? '',
            bairro: t.endereco.bairro,
            cep: t.endereco.cep,
          }
        : null,
    },
    descricaoServico: p.descricao,
    informacoesComplementares: p.informacoes ?? '',
    issRetido: Boolean(p.reterIss),
    valores: {
      valorServico: p.valor,
      baseCalculo: p.valor,
      aliquotaIss: 0,
      valorIss: 0,
      valorLiquido: p.valor,
      tributosAproximados: (p.valor * (p.taxa ?? 0)) / 100,
    },
    // Vazio: a DANFSe recolhe o bloco da reforma numa linha só.
    ibsCbs: {
      cst: '',
      classTrib: '',
      indicadorOperacao: '',
      localIncidencia: '',
      aliquotaIbsUf: 0,
      aliquotaEfetivaIbsUf: 0,
      valorIbsUf: 0,
      aliquotaIbsMun: 0,
      aliquotaEfetivaIbsMun: 0,
      valorIbsMun: 0,
      valorIbsTotal: 0,
      aliquotaCbs: 0,
      aliquotaEfetivaCbs: 0,
      valorCbs: 0,
    },
  };
  return renderDanfsePdf(data);
}
