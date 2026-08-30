export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt, HelpCircle, ClipboardList, UploadCloud, Building2, Activity } from 'lucide-react';
import { getDb, eq, desc, withDbTimeout } from '@hexxa/db';
import { company, serviceInvoice, ticket, monthlyClosure, taxHistory } from '@hexxa/db/schema';

type Event = { date: Date; icon: 'invoice' | 'ticket' | 'closure' | 'pgdas' | 'company'; title: string; detail?: string };

export default async function AdminAtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [comp] = await withDbTimeout(db.select().from(company).where(eq(company.id, id)), 8000);
  if (!comp) notFound();

  let invoices: (typeof serviceInvoice.$inferSelect)[] = [];
  let tickets: (typeof ticket.$inferSelect)[] = [];
  let closures: (typeof monthlyClosure.$inferSelect)[] = [];
  let pgdas: (typeof taxHistory.$inferSelect)[] = [];
  try {
    [invoices, tickets, closures, pgdas] = await withDbTimeout(
      Promise.all([
        db.select().from(serviceInvoice).where(eq(serviceInvoice.companyId, id)).orderBy(desc(serviceInvoice.createdAt)).limit(20),
        db.select().from(ticket).where(eq(ticket.companyId, id)).orderBy(desc(ticket.createdAt)).limit(20),
        db.select().from(monthlyClosure).where(eq(monthlyClosure.companyId, id)).orderBy(desc(monthlyClosure.createdAt)).limit(20),
        db.select().from(taxHistory).where(eq(taxHistory.companyId, id)).orderBy(desc(taxHistory.createdAt)).limit(20),
      ]),
      8000,
    );
  } catch (err) {
    console.error('[AdminAtividadePage] falha ao carregar atividade:', err);
  }

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

  const ICONS = { invoice: Receipt, ticket: HelpCircle, closure: ClipboardList, pgdas: UploadCloud, company: Building2 };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3]">Atividade — {comp.legalName}</h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Linha do tempo real: notas emitidas, solicitações, fechamentos e PGDAS processados.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-2 sm:p-4 shadow-sm">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <Activity className="h-10 w-10 opacity-20" />
            <p className="text-xs">Nenhuma atividade registrada ainda para esta empresa.</p>
          </div>
        ) : (
          <ol className="divide-y divide-black/5 dark:divide-white/10">
            {events.map((e, i) => {
              const Icon = ICONS[e.icon];
              return (
                <li key={i} className="flex items-start gap-3.5 p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{e.title}</p>
                    {e.detail && <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5 truncate">{e.detail}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] whitespace-nowrap bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-full">
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

