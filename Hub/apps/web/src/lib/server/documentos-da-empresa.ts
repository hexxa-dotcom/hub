import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { getStatusDoCertificado } from '@/lib/server/certificado';
import { anexosDaContabilidade, protocoloDoPedido } from '@/lib/server/servicos';

/**
 * DOCUMENTOS DA EMPRESA — tudo num lugar só.
 *
 * Antes era uma lista que só aceitava um link colado, e ninguém usava. Os
 * documentos de verdade estavam espalhados: o que o contador envia ia só para
 * a Central, o certificado ficava nas configurações, os contratos em
 * Contratos. Aqui eles se juntam:
 *
 *   EMPRESA  — o que a própria empresa sobe (com o arquivo);
 *   CONTADOR — o que a contabilidade enviou pela Central (certidões,
 *              contrato social, declarações), menos as guias de imposto.
 *
 * E um checklist do essencial, com a validade de cada um e, onde faltar, o
 * caminho: enviar o arquivo ou pedir à contabilidade.
 */

import { CATEGORIAS, type Categoria } from '@/lib/documentos-categorias';
export { CATEGORIAS, type Categoria };

/**
 * O essencial de uma prestadora de serviços. `servico` é o nome no catálogo
 * de Serviços Adicionais — o "pedir à contabilidade" já abre o pedido certo.
 */
export const ESSENCIAL: { categoria: Categoria; vence: boolean; servico: string | null; comoObter: string; link?: string }[] = [
  { categoria: 'CONTRATO_SOCIAL', vence: false, servico: null, comoObter: 'Registrado na Junta Comercial — a contabilidade tem a cópia.' },
  { categoria: 'CNPJ', vence: false, servico: null, comoObter: 'Emitido no site da Receita Federal.', link: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp' },
  { categoria: 'ALVARA', vence: true, servico: null, comoObter: 'Emitido pela prefeitura.' },
  { categoria: 'CND_FEDERAL', vence: true, servico: 'Certidão Negativa Federal (CND)', comoObter: 'Receita Federal e PGFN, vale 180 dias.' },
  { categoria: 'CND_MUNICIPAL', vence: true, servico: 'Certidão Negativa Municipal', comoObter: 'Prefeitura, em geral vale 90 dias.' },
  { categoria: 'CRF_FGTS', vence: true, servico: 'Certidão FGTS (CRF)', comoObter: 'Caixa Econômica Federal, vale 30 dias.' },
];

export interface Documento {
  id: string;
  origem: 'EMPRESA' | 'CONTADOR';
  categoria: Categoria;
  nome: string;
  emitidoEm: string | null;
  validoAte: string | null;
  temArquivo: boolean;
  /** Onde abrir o arquivo (dentro do Hub). */
  href: string | null;
  protocolo: string | null;
}

/** O que o contador enviou, na categoria mais provável pelo tipo e pelo título. */
function categoriaDaEntrega(tipo: string, titulo: string): Categoria {
  const t = titulo.toLowerCase();
  if (tipo === 'CERTIDAO') {
    if (/fgts|crf/.test(t)) return 'CRF_FGTS';
    if (/municip|prefeit|iss/.test(t)) return 'CND_MUNICIPAL';
    if (/estad|icms|sefaz/.test(t)) return 'CND_ESTADUAL';
    if (/federal|receita|pgfn|cnd|cpend/.test(t)) return 'CND_FEDERAL';
    return 'CND';
  }
  if (tipo === 'CONTRATO') return /social|altera|consolid/.test(t) ? 'CONTRATO_SOCIAL' : 'CONTRATO';
  if (/alvar/.test(t)) return 'ALVARA';
  if (/cart[aã]o cnpj|comprovante de inscri/.test(t)) return 'CNPJ';
  return 'OUTRO';
}

export async function listarDocumentos(ctx: TenantContext): Promise<Documento[]> {
  // O que a contabilidade anexou ao atender um pedido de serviço (a certidão
  // pedida, a declaração) também é documento da empresa.
  const anexos = await anexosDaContabilidade(ctx).catch(() => []);
  const dosPedidos: Documento[] = anexos.map((a) => ({
    id: a.id,
    origem: 'CONTADOR',
    categoria: categoriaDaEntrega(/certid|crf|cnd/i.test(a.subject) ? 'CERTIDAO' : 'OUTRO', `${a.subject} ${a.attachment_name ?? ''}`),
    nome: a.attachment_name ? `${a.subject} — ${a.attachment_name}` : a.subject,
    emitidoEm: a.em,
    validoAte: null,
    temArquivo: true,
    href: `/api/chamados/anexo/${a.id}`,
    protocolo: protocoloDoPedido(a.pedido),
  }));
  return withTenant(ctx.companyId, async (tx) => {
    const proprios = (await tx.execute(sql`
      SELECT id, category, name, to_char(issued_at, 'YYYY-MM-DD') AS emitido, to_char(expires_at, 'YYYY-MM-DD') AS validade,
             (file_data IS NOT NULL OR file_url IS NOT NULL) AS tem_arquivo
        FROM company_document
       WHERE company_id = ${ctx.companyId}
       ORDER BY created_at DESC
    `)) as unknown as { id: string; category: Categoria; name: string; emitido: string | null; validade: string | null; tem_arquivo: boolean }[];

    const enviados = (await tx.execute(sql`
      SELECT id, tipo, titulo, protocolo, to_char(enviado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS emitido,
             to_char(vencimento, 'YYYY-MM-DD') AS validade, arquivo IS NOT NULL AS tem_arquivo
        FROM document_delivery
       WHERE company_id = ${ctx.companyId} AND tipo <> 'GUIA'
       ORDER BY enviado_em DESC
    `)) as unknown as { id: string; tipo: string; titulo: string; protocolo: string; emitido: string; validade: string | null; tem_arquivo: boolean }[];

    return [
      ...proprios.map((d) => ({
        id: d.id,
        origem: 'EMPRESA' as const,
        categoria: d.category,
        nome: d.name,
        emitidoEm: d.emitido,
        validoAte: d.validade,
        temArquivo: d.tem_arquivo,
        href: d.tem_arquivo ? `/api/documentos-da-empresa/${d.id}` : null,
        protocolo: null,
      })),
      ...enviados.map((d) => ({
        id: d.id,
        origem: 'CONTADOR' as const,
        categoria: categoriaDaEntrega(d.tipo, d.titulo),
        nome: d.titulo,
        emitidoEm: d.emitido,
        validoAte: d.validade,
        temArquivo: d.tem_arquivo,
        // Abre pelo mesmo caminho da Central: fica registrado que a empresa viu.
        href: d.tem_arquivo ? `/api/documentos/${d.id}` : null,
        protocolo: d.protocolo,
      })),
      ...dosPedidos,
    ];
  });
}

export type SituacaoDoEssencial = 'EM_DIA' | 'VENCE_EM_BREVE' | 'VENCIDO' | 'FALTA';

export interface ItemDoEssencial {
  categoria: Categoria;
  nome: string;
  situacao: SituacaoDoEssencial;
  documento: Documento | null;
  diasParaVencer: number | null;
  servico: string | null;
  comoObter: string;
  /** Onde emitir por conta própria (ex.: cartão CNPJ na Receita). */
  link: string | null;
}

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoje()}T12:00:00Z`)) / 86400000);

export function checklist(docs: Documento[]): ItemDoEssencial[] {
  return ESSENCIAL.map((e) => {
    // O mais recente da categoria (as certidões antigas, sem subtipo, contam como federal).
    const daCategoria = docs
      .filter((d) => d.categoria === e.categoria || (e.categoria === 'CND_FEDERAL' && d.categoria === 'CND'))
      .sort((a, b) => (b.validoAte ?? b.emitidoEm ?? '').localeCompare(a.validoAte ?? a.emitidoEm ?? ''));
    const doc = daCategoria[0] ?? null;
    const dias = doc?.validoAte ? diasAte(doc.validoAte) : null;
    const situacao: SituacaoDoEssencial = !doc
      ? 'FALTA'
      : !e.vence || dias === null
        ? 'EM_DIA'
        : dias < 0
          ? 'VENCIDO'
          : dias <= 30
            ? 'VENCE_EM_BREVE'
            : 'EM_DIA';
    return { categoria: e.categoria, nome: CATEGORIAS[e.categoria], situacao, documento: doc, diasParaVencer: dias, servico: e.servico, comoObter: e.comoObter, link: e.link ?? null };
  });
}

/** O que o Hub já sabe e completa o quadro: o certificado digital e os contratos assinados. */
export async function extrasDosDocumentos(ctx: TenantContext) {
  const [cert, contratos] = await Promise.all([
    getStatusDoCertificado(ctx).catch(() => null),
    withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM business_contract
         WHERE company_id = ${ctx.companyId} AND status = 'ATIVO'
      `),
    ) as unknown as Promise<{ n: number }[]>,
  ]);
  return {
    certificado: cert
      ? { nivel: cert.nivel, mensagem: cert.mensagem, validoAte: cert.ficha?.validoAte ?? null }
      : { nivel: 'AUSENTE', mensagem: 'Certificado digital não enviado.', validoAte: null },
    contratosAtivos: contratos[0]?.n ?? 0,
  };
}
