import 'server-only';
import nodemailer from 'nodemailer';
import {
  getDb,
  withTenant,
  withDbTimeout,
  sql,
  criarEntrega,
  registrarEventoDaEntrega,
  AdminTaxGuideRepository,
  type TipoDeDocumento,
} from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { decryptSecret } from './secret-crypto';

/**
 * A ENTREGA DE DOCUMENTOS ENTRE O ESCRITÓRIO E O CLIENTE — ver migration 0070.
 *
 * Três pontas: o contador envia (com arquivo, e opcionalmente valor e
 * vencimento, que fazem do documento uma guia a pagar); o cliente abre, baixa
 * e confirma; e tudo vira linha do tempo com protocolo, para responder "não
 * recebi" com data e hora.
 */

export const TIPOS_DE_DOCUMENTO: Record<TipoDeDocumento, string> = {
  GUIA: 'Guia',
  DECLARACAO: 'Declaração',
  CERTIDAO: 'Certidão',
  CONTRATO: 'Contrato',
  RECIBO: 'Recibo',
  OUTRO: 'Outro',
};

/** A contabilidade: é dela a conta de e-mail que avisa os clientes. */
const CNPJ_DO_ESCRITORIO = '62.414.421/0001-16';
const MAX_ARQUIVO = 4 * 1024 * 1024;

export interface Entrega {
  id: string;
  companyId: string;
  empresa?: string;
  protocolo: string;
  taxGuideId: string | null;
  origem: 'CONTADOR' | 'ONEFLOW';
  tipo: TipoDeDocumento;
  titulo: string;
  descricao: string | null;
  arquivoNome: string | null;
  temArquivo: boolean;
  valor: number | null;
  vencimento: string | null;
  pago: boolean;
  pixCode: string | null;
  enviadoEm: string;
  visualizadoEm: string | null;
  confirmadoEm: string | null;
}

export interface EventoDeEntrega {
  tipo: string;
  em: string;
  detalhe: string | null;
}

type Linha = Record<string, unknown>;

function paraEntrega(r: Linha): Entrega {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    empresa: (r.empresa as string) ?? undefined,
    protocolo: r.protocolo as string,
    taxGuideId: (r.tax_guide_id as string) ?? null,
    origem: r.origem as Entrega['origem'],
    tipo: r.tipo as TipoDeDocumento,
    titulo: r.titulo as string,
    descricao: (r.descricao as string) ?? null,
    arquivoNome: (r.arquivo_nome as string) ?? null,
    temArquivo: Boolean(r.tem_arquivo),
    valor: r.valor != null ? Number(r.valor) : null,
    vencimento: r.vencimento ? String(r.vencimento).slice(0, 10) : null,
    pago: r.guia_status === 'PAID',
    pixCode: (r.pix_code as string) ?? null,
    enviadoEm: iso(r.enviado_em)!,
    visualizadoEm: iso(r.visualizado_em),
    confirmadoEm: iso(r.confirmado_em),
  };
}

const COLUNAS = sql`
  d.id, d.company_id, d.protocolo, d.tax_guide_id, d.origem, d.tipo, d.titulo, d.descricao, d.arquivo_nome,
  (d.arquivo IS NOT NULL OR g.file_url IS NOT NULL) AS tem_arquivo,
  d.valor, d.vencimento, d.enviado_em, d.visualizado_em, d.confirmado_em,
  g.status AS guia_status, g.pix_code
`;

// ── Área do cliente ─────────────────────────────────────────────────────

export async function listarEntregasDoCliente(ctx: TenantContext): Promise<Entrega[]> {
  const linhas = await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT ${COLUNAS}
        FROM document_delivery d
        LEFT JOIN tax_guide g ON g.id = d.tax_guide_id
       WHERE d.company_id = ${ctx.companyId}
       ORDER BY d.enviado_em DESC
    `),
  );
  return (linhas as unknown as Linha[]).map(paraEntrega);
}

/** O arquivo de uma entrega, de onde ele estiver: anexado ou na guia. */
export async function arquivoDaEntrega(
  ctx: TenantContext,
  id: string,
): Promise<{ conteudo: string; nome: string } | null> {
  const [r] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT COALESCE(d.arquivo, g.file_url) AS conteudo, d.arquivo_nome, d.titulo, d.protocolo
        FROM document_delivery d
        LEFT JOIN tax_guide g ON g.id = d.tax_guide_id
       WHERE d.id = ${id} AND d.company_id = ${ctx.companyId}
    `),
  )) as unknown as { conteudo: string | null; arquivo_nome: string | null; titulo: string; protocolo: string }[];
  if (!r?.conteudo) return null;
  return { conteudo: r.conteudo, nome: r.arquivo_nome ?? `${r.protocolo} - ${r.titulo}.pdf` };
}

export async function registrarEventoDoCliente(
  ctx: TenantContext,
  id: string,
  tipo: 'VISUALIZADO' | 'BAIXADO' | 'CONFIRMADO' | 'ABERTO_PELO_CONTADOR',
  detalhe: string | null = null,
): Promise<void> {
  await withTenant(ctx.companyId, async (tx) => {
    const [existe] = (await tx.execute(
      sql`SELECT 1 FROM document_delivery WHERE id = ${id} AND company_id = ${ctx.companyId}`,
    )) as unknown as unknown[];
    if (existe) await registrarEventoDaEntrega(tx, id, ctx.companyId, tipo, detalhe);
  });
}

// ── Área do contador ────────────────────────────────────────────────────

export async function listarEntregasDoEscritorio(companyId?: string): Promise<Entrega[]> {
  const filtro = companyId ? sql`WHERE d.company_id = ${companyId}` : sql``;
  const linhas = await withDbTimeout(
    getDb().execute(sql`
      SELECT ${COLUNAS}, c.legal_name AS empresa
        FROM document_delivery d
        JOIN company c ON c.id = d.company_id
        LEFT JOIN tax_guide g ON g.id = d.tax_guide_id
        ${filtro}
       ORDER BY d.enviado_em DESC
       LIMIT 300
    `),
    8000,
  );
  return (linhas as unknown as Linha[]).map(paraEntrega);
}

export async function historicoDaEntrega(id: string): Promise<EventoDeEntrega[]> {
  const linhas = (await getDb().execute(sql`
    SELECT tipo, em, detalhe FROM document_delivery_event WHERE delivery_id = ${id} ORDER BY em
  `)) as unknown as { tipo: string; em: string; detalhe: string | null }[];
  return linhas.map((l) => ({ tipo: l.tipo, em: new Date(l.em).toISOString(), detalhe: l.detalhe }));
}

export interface DocumentoParaEnviar {
  companyId: string;
  tipo: TipoDeDocumento;
  titulo: string;
  descricao: string | null;
  arquivo: File | null;
  valor: number | null;
  vencimento: string | null;
  avisarPorEmail: boolean;
  enviadoPor: string | null;
}

export async function enviarDocumento(d: DocumentoParaEnviar): Promise<{ protocolo: string; email: string }> {
  let arquivo: string | null = null;
  if (d.arquivo && d.arquivo.size > 0) {
    if (d.arquivo.size > MAX_ARQUIVO) throw new Error('Arquivo grande demais (máx. 4 MB).');
    const mime = d.arquivo.type || 'application/pdf';
    arquivo = `data:${mime};base64,${Buffer.from(await d.arquivo.arrayBuffer()).toString('base64')}`;
  }

  const db = getDb();
  // Com valor e vencimento, o documento é algo a pagar: entra também na lista
  // de guias do cliente, com o mesmo arquivo, e a entrega aponta para ela.
  let taxGuideId: string | null = null;
  if (d.valor && d.valor > 0 && d.vencimento) {
    const { id } = await new AdminTaxGuideRepository().create(db, d.companyId, {
      taxName: d.titulo,
      referenceMonth: `${d.vencimento.slice(0, 7)}-01`,
      amount: d.valor,
      dueDate: d.vencimento,
      fileUrl: arquivo,
    });
    taxGuideId = id;
  }

  const entrega = await criarEntrega(db, {
    companyId: d.companyId,
    origem: 'CONTADOR',
    tipo: d.tipo,
    titulo: d.titulo,
    descricao: d.descricao,
    // O arquivo de uma guia fica na guia; guardar duas vezes só dobra o banco.
    arquivo: taxGuideId ? null : arquivo,
    arquivoNome: d.arquivo?.name ?? null,
    valor: d.valor,
    vencimento: d.vencimento,
    taxGuideId,
    enviadoPor: d.enviadoPor,
  });

  const email = d.avisarPorEmail ? await avisarPorEmail(entrega.id) : 'não solicitado';
  return { protocolo: entrega.protocolo, email };
}

/**
 * Avisa o cliente por e-mail, pela conta do escritório. O aviso não leva o
 * arquivo: leva o protocolo e o caminho para abrir na Hexx — é a abertura lá
 * que fica registrada, e é ela que prova o recebimento.
 */
export async function avisarPorEmail(deliveryId: string): Promise<string> {
  const db = getDb();
  const [e] = (await db.execute(sql`
    SELECT d.company_id, d.protocolo, d.titulo, d.valor, d.vencimento, c.legal_name
      FROM document_delivery d JOIN company c ON c.id = d.company_id
     WHERE d.id = ${deliveryId}
  `)) as unknown as { company_id: string; protocolo: string; titulo: string; valor: string | null; vencimento: string | null; legal_name: string }[];
  if (!e) return 'entrega não encontrada';

  const nao = async (motivo: string) => {
    await registrarEventoDaEntrega(db, deliveryId, e.company_id, 'EMAIL_NAO_ENVIADO', motivo);
    return `não enviado: ${motivo}`;
  };

  const destinatarios = (await db.execute(sql`
    SELECT DISTINCT email FROM (
      SELECT u.email FROM membership m JOIN app_user u ON u.id = m.user_id
       WHERE m.company_id = ${e.company_id} AND m.role = 'OWNER'
      UNION
      SELECT n.email_contato FROM nfse_config n WHERE n.company_id = ${e.company_id}
    ) x
    WHERE email IS NOT NULL AND email NOT LIKE '%.invalido'
  `)) as unknown as { email: string }[];
  if (destinatarios.length === 0) return nao('o cliente não tem e-mail cadastrado');

  const [conta] = (await db.execute(sql`
    SELECT a.email_address, a.smtp_host, a.smtp_port, a.password, a.is_active
      FROM email_account a JOIN company c ON c.id = a.company_id
     WHERE c.cnpj = ${CNPJ_DO_ESCRITORIO} AND a.is_active
     LIMIT 1
  `)) as unknown as { email_address: string; smtp_host: string | null; smtp_port: string | null; password: string | null }[];
  if (!conta?.smtp_host || !conta.password) {
    return nao('a HEXX não tem conta de e-mail conectada (Configurações > Integrações)');
  }

  const valor = e.valor ? ` no valor de R$ ${Number(e.valor).toFixed(2).replace('.', ',')}` : '';
  const venc = e.vencimento ? `, com vencimento em ${String(e.vencimento).slice(0, 10).split('-').reverse().join('/')}` : '';
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://hexx-hub.vercel.app'}/minha-contabilidade/guias`;

  try {
    await nodemailer
      .createTransport({
        host: conta.smtp_host,
        port: Number(conta.smtp_port) || 465,
        secure: Number(conta.smtp_port) === 465,
        auth: { user: conta.email_address, pass: decryptSecret(conta.password)! },
      })
      .sendMail({
        from: conta.email_address,
        to: destinatarios.map((d) => d.email).join(', '),
        subject: `${e.titulo} — protocolo ${e.protocolo}`,
        text:
          `Olá, ${e.legal_name}!\n\n` +
          `Sua contabilidade enviou um documento: ${e.titulo}${valor}${venc}.\n` +
          `Protocolo: ${e.protocolo}\n\n` +
          `Abra na Hexx: ${url}\n\n` +
          `HEXX Contabilidade`,
      });
  } catch (err) {
    return nao(err instanceof Error ? err.message : 'falha no envio');
  }
  await registrarEventoDaEntrega(db, deliveryId, e.company_id, 'EMAIL_ENVIADO', destinatarios.map((d) => d.email).join(', '));
  return 'enviado';
}
