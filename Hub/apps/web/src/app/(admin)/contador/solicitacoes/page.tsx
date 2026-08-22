import { getDb } from '@hexxa/db/client';
import { ticket, ticketMessage, company, appUser } from '@hexxa/db/schema';
import { eq, desc } from 'drizzle-orm';
import { SolicitacoesList, type Solicitacao } from './SolicitacoesList';

async function getSolicitacoes(): Promise<Solicitacao[]> {
  const db = getDb();

  const [tickets, messages] = await Promise.all([
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
      .orderBy(desc(ticket.createdAt)),
    db
      .select({
        id: ticketMessage.id,
        ticketId: ticketMessage.ticketId,
        body: ticketMessage.body,
        createdAt: ticketMessage.createdAt,
        authorName: appUser.name,
      })
      .from(ticketMessage)
      .leftJoin(appUser, eq(ticketMessage.authorUserId, appUser.id))
      .orderBy(ticketMessage.createdAt),
  ]);

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
      autor: m.authorName ?? 'Admin',
      msg: m.body,
      quando: m.createdAt.toLocaleString('pt-BR'),
    })),
  }));
}

export default async function AdminSolicitacoesPage() {
  const items = await getSolicitacoes();
  return <SolicitacoesList initial={items} />;
}
