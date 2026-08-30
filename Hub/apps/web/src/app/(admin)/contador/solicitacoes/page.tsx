export const dynamic = 'force-dynamic';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { ticket, ticketMessage, company, appUser } from '@hexxa/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { SolicitacoesList, type Solicitacao } from './SolicitacoesList';

const TICKETS_LIMIT = 200;

async function getSolicitacoes(): Promise<Solicitacao[]> {
  const db = getDb();

  const tickets = await withDbTimeout(
    db
      .select({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        legalName: company.legalName,
        tradeName: company.tradeName,
        useTradeName: company.useTradeName,
      })
      .from(ticket)
      .innerJoin(company, eq(ticket.companyId, company.id))
      .orderBy(desc(ticket.createdAt))
      .limit(TICKETS_LIMIT),
    8000,
  );

  const ticketIds = tickets.map(t => t.id);
  const messages = ticketIds.length === 0 ? [] : await withDbTimeout(
    db
      .select({
        id: ticketMessage.id,
        ticketId: ticketMessage.ticketId,
        body: ticketMessage.body,
        createdAt: ticketMessage.createdAt,
        sender: ticketMessage.sender,
        authorName: appUser.name,
      })
      .from(ticketMessage)
      .leftJoin(appUser, eq(ticketMessage.authorUserId, appUser.id))
      .where(inArray(ticketMessage.ticketId, ticketIds))
      .orderBy(ticketMessage.createdAt),
    8000,
  );

  const messagesByTicket = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = messagesByTicket.get(m.ticketId) ?? [];
    list.push(m);
    messagesByTicket.set(m.ticketId, list);
  }

  return tickets.map(t => ({
    id: t.id,
    cliente: t.useTradeName && t.tradeName ? t.tradeName : t.legalName,
    titulo: t.subject,
    prioridade: t.priority,
    status: t.status,
    criada: t.createdAt.toISOString().slice(0, 10),
    respostas: (messagesByTicket.get(t.id) ?? []).map(m => ({
      autor: m.sender === 'ACCOUNTING' ? (m.authorName ?? 'Equipe Contábil') : 'Cliente',
      msg: m.body,
      quando: m.createdAt.toLocaleString('pt-BR'),
    })),
  }));
}

export default async function AdminSolicitacoesPage() {
  let items: Solicitacao[] = [];
  try {
    items = await getSolicitacoes();
  } catch (err) {
    console.error('[AdminSolicitacoesPage] falha ao carregar dados:', err);
  }
  return <SolicitacoesList initial={items} />;
}
