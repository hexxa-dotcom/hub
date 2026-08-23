export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt, Question, ClipboardText, CloudArrowUp, Buildings, Pulse } from '@phosphor-icons/react/dist/ssr';
import { getDb, eq, desc } from '@hexxa/db';
import { company, serviceInvoice, ticket, monthlyClosure, taxHistory } from '@hexxa/db/schema';

type Event = { date: Date; icon: 'invoice' | 'ticket' | 'closure' | 'pgdas' | 'company'; title: string; detail?: string };

export default async function AdminAtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [comp] = await db.select().from(company).where(eq(company.id, id));
  if (!comp) notFound();

  const [invoices, tickets, closures, pgdas] = await Promise.all([
    db.select().from(serviceInvoice).where(eq(serviceInvoice.companyId, id)).orderBy(desc(serviceInvoice.createdAt)).limit(20),
    db.select().from(ticket).where(eq(ticket.companyId, id)).orderBy(desc(ticket.createdAt)).limit(20),
    db.select().from(monthlyClosure).where(eq(monthlyClosure.companyId, id)).orderBy(desc(monthlyClosure.createdAt)).limit(20),
    db.select().from(taxHistory).where(eq(taxHistory.companyId, id)).orderBy(desc(taxHistory.createdAt)).limit(20),
  ]);

  const events: Event[] = [
    { date: comp.createdAt, icon: 'company', title: 'Empresa cadastrada na plataforma' } satisfies Event,
    ...invoices.map((i): Event => ({
      date: i.createdAt,
      icon: 'invoice',
      title: `NFSe ${i.nfseNumber ? `nº ${i.nfseNumber}` : ''} — ${i.status}`,
      detail: i.serviceDescription,
    })),
    ...tickets.map((t): Event => ({
      date: t.createdAt,
      icon: 'ticket',
      title: `Solicitação aberta: ${t.subject}`,
      detail: t.status === 'OPEN' ? 'Aguardando resposta' : `Status: ${t.status}`,
    })),
    ...closures.map((c): Event => ({
      date: c.createdAt,
      icon: 'closure',
      title: `Fechamento mensal processado — ref. ${c.referenceMonth}`,
    })),
    ...pgdas.map((p): Event => ({
      date: p.createdAt,
      icon: 'pgdas',
      title: `PGDAS processado — ${p.referenceMonth}`,
      detail: `${p.taxBracket} · alíquota ${p.effectiveRate}%`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const ICONS = { invoice: Receipt, ticket: Question, closure: ClipboardText, pgdas: CloudArrowUp, company: Buildings };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Atividade — {comp.legalName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Linha do tempo real: notas emitidas, solicitações, fechamentos e PGDAS processados.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
            <Pulse className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhuma atividade registrada ainda para esta empresa.</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((e, i) => {
              const Icon = ICONS[e.icon];
              return (
                <li key={i} className="flex items-start gap-3 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-800">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{e.title}</p>
                    {e.detail && <p className="text-xs text-slate-400 mt-0.5 truncate">{e.detail}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                    {e.date.toLocaleDateString('pt-BR')}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
