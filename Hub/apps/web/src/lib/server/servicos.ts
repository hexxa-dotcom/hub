import 'server-only';
import { getDb, withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import type { TipoDePreco } from '@/lib/servicos-preco';

/**
 * SERVIÇOS ADICIONAIS — o catálogo do escritório e os pedidos da empresa.
 *
 * O pedido é um chamado (`ticket`) com categoria SERVICO: a mesma fila que o
 * contador já atende em /contador/solicitacoes, mas separado dos chamados do
 * Suporte (antes os dois apareciam misturados em "Minhas solicitações"). A
 * conversa é completa, com anexo nos dois sentidos.
 */

export const CATEGORIA_DO_PEDIDO = 'SERVICO';

export interface ServicoDoCatalogo {
  id: string;
  categoria: string;
  nome: string;
  descricao: string;
  prazo: string;
  precoTipo: TipoDePreco;
  preco: number | null;
  ativo: boolean;
  ordem: number;
}

export async function listarCatalogo(incluirInativos = false): Promise<ServicoDoCatalogo[]> {
  const linhas = (await getDb().execute(sql`
    SELECT id, categoria, nome, descricao, prazo, preco_tipo, preco, ativo, ordem
      FROM service_catalog
     ${incluirInativos ? sql`` : sql`WHERE ativo`}
     ORDER BY ordem, nome
  `)) as unknown as { id: string; categoria: string; nome: string; descricao: string; prazo: string; preco_tipo: TipoDePreco; preco: string | null; ativo: boolean; ordem: number }[];
  return linhas.map((l) => ({ ...l, precoTipo: l.preco_tipo, preco: l.preco != null ? Number(l.preco) : null }));
}

export type SituacaoDoPedido = 'RECEBIDO' | 'EM_ANDAMENTO' | 'AGUARDANDO_VOCE' | 'CONCLUIDO' | 'CANCELADO';
const SITUACAO: Record<string, SituacaoDoPedido> = {
  OPEN: 'RECEBIDO',
  IN_PROGRESS: 'EM_ANDAMENTO',
  WAITING_CLIENT: 'AGUARDANDO_VOCE',
  RESOLVED: 'CONCLUIDO',
  CLOSED: 'CANCELADO',
};

export interface MensagemDoPedido {
  id: string;
  daContabilidade: boolean;
  texto: string;
  em: string;
  anexo: { nome: string; href: string } | null;
}

export interface Pedido {
  id: string;
  protocolo: string;
  servico: string;
  urgente: boolean;
  situacao: SituacaoDoPedido;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: MensagemDoPedido[];
}

/** "SRV-4F2A9C": curto, para a pessoa citar ao falar com o escritório. */
export const protocoloDoPedido = (id: string) => `SRV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

export async function listarPedidos(ctx: TenantContext): Promise<Pedido[]> {
  return withTenant(ctx.companyId, async (tx) => {
    const pedidos = (await tx.execute(sql`
      SELECT id, subject, priority::text AS priority, status::text AS status, created_at
        FROM ticket
       WHERE company_id = ${ctx.companyId} AND category = ${CATEGORIA_DO_PEDIDO}
       ORDER BY created_at DESC
    `)) as unknown as { id: string; subject: string; priority: string; status: string; created_at: Date }[];
    if (!pedidos.length) return [];
    const msgs = (await tx.execute(sql`
      SELECT id, ticket_id, sender, body, created_at, attachment_name, attachment IS NOT NULL AS tem_anexo
        FROM ticket_message
       WHERE ticket_id IN (${sql.join(pedidos.map((p) => sql`${p.id}::uuid`), sql`, `)})
       ORDER BY created_at
    `)) as unknown as { id: string; ticket_id: string; sender: string; body: string; created_at: Date; attachment_name: string | null; tem_anexo: boolean }[];

    return pedidos.map((p) => {
      const daqui = msgs.filter((m) => m.ticket_id === p.id);
      return {
        id: p.id,
        protocolo: protocoloDoPedido(p.id),
        servico: p.subject,
        urgente: p.priority === 'URGENT' || p.priority === 'HIGH',
        situacao: SITUACAO[p.status] ?? 'RECEBIDO',
        criadoEm: new Date(p.created_at).toISOString(),
        atualizadoEm: new Date(daqui[daqui.length - 1]?.created_at ?? p.created_at).toISOString(),
        mensagens: daqui.map((m) => ({
          id: m.id,
          daContabilidade: m.sender === 'ACCOUNTING',
          texto: m.body,
          em: new Date(m.created_at).toISOString(),
          anexo: m.tem_anexo ? { nome: m.attachment_name ?? 'anexo', href: `/api/chamados/anexo/${m.id}` } : null,
        })),
      };
    });
  });
}

/** Arquivos que a contabilidade anexou nos pedidos de serviço — entram em Documentos da Empresa. */
export async function anexosDaContabilidade(ctx: TenantContext) {
  return (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT m.id, m.attachment_name, t.subject, to_char(m.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS em, t.id AS pedido
        FROM ticket_message m
        JOIN ticket t ON t.id = m.ticket_id
       WHERE t.company_id = ${ctx.companyId} AND t.category = ${CATEGORIA_DO_PEDIDO}
         AND m.sender = 'ACCOUNTING' AND m.attachment IS NOT NULL
       ORDER BY m.created_at DESC
    `),
  )) as unknown as { id: string; attachment_name: string | null; subject: string; em: string; pedido: string }[];
}

export const ANEXO_VALIDO = /^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/;
