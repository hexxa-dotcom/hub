import Link from 'next/link';
import { Users, WarningCircle, Clock, ArrowRight, CurrencyDollar } from '@phosphor-icons/react/dist/ssr';
import { getDb, eq, desc } from '@hexxa/db';
import { company, subscription, plan, ticket } from '@hexxa/db/schema';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function KPICard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${color ?? 'bg-brand-500/10 text-brand-600'}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const PRIORIDADE_CLS: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const PRIORIDADE_LABEL: Record<string, string> = { URGENT: '⚡ Urgente', HIGH: '⚡ Alta', MEDIUM: '○ Média', LOW: '· Baixa' };

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  TRIAL: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAST_DUE: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELED: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'ativo', TRIAL: 'trial', PAST_DUE: 'inadimplente', CANCELED: 'cancelado' };

function displayName(c: { legalName: string; tradeName: string | null; useTradeName: boolean }) {
  return c.useTradeName && c.tradeName ? c.tradeName : c.legalName;
}

export default async function AdminDashboard() {
  const db = getDb();

  const [subs, openTickets] = await Promise.all([
    db
      .select({
        companyId: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        useTradeName: company.useTradeName,
        planName: plan.name,
        monthlyValue: plan.monthlyValue,
        status: subscription.status,
      })
      .from(subscription)
      .innerJoin(company, eq(subscription.companyId, company.id))
      .innerJoin(plan, eq(subscription.planId, plan.id)),
    db
      .select({
        id: ticket.id,
        subject: ticket.subject,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        companyName: company.legalName,
        companyTradeName: company.tradeName,
        companyUseTrade: company.useTradeName,
      })
      .from(ticket)
      .innerJoin(company, eq(ticket.companyId, company.id))
      .where(eq(ticket.status, 'OPEN'))
      .orderBy(desc(ticket.createdAt))
      .limit(10),
  ]);

  const ativos = subs.filter(s => s.status === 'ACTIVE').length;
  const mrr = subs.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + Number(s.monthlyValue), 0);
  const inadimplentes = subs.filter(s => s.status === 'PAST_DUE').length;
  const trials = subs.filter(s => s.status === 'TRIAL').length;

  const porPlano = new Map<string, { count: number; monthlyValue: number }>();
  for (const s of subs) {
    const entry = porPlano.get(s.planName) ?? { count: 0, monthlyValue: Number(s.monthlyValue) };
    entry.count += 1;
    porPlano.set(s.planName, entry);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Visão geral da operação — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<CurrencyDollar className="h-4 w-4" />} label="MRR" value={BRL.format(mrr)} sub="valor mensal recorrente" color="bg-green-50 text-green-600" />
        <KPICard icon={<Users className="h-4 w-4" />} label="Clientes ativos" value={String(ativos)} sub={`${trials} em trial`} />
        <KPICard icon={<WarningCircle className="h-4 w-4" />} label="Inadimplentes" value={String(inadimplentes)} sub="Requer ação" color="bg-red-50 text-red-600" />
        <KPICard icon={<Clock className="h-4 w-4" />} label="Solicitações abertas" value={String(openTickets.length)} sub="Aguardando resposta" color="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Solicitações abertas */}
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Solicitações abertas</h2>
            <Link href="/contador/solicitacoes" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {openTickets.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma solicitação em aberto.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {openTickets.map(t => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORIDADE_CLS[t.priority]}`}>
                        {PRIORIDADE_LABEL[t.priority]}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {t.companyUseTrade && t.companyTradeName ? t.companyTradeName : t.companyName}
                    </p>
                    <p className="text-xs text-slate-500">{t.subject}</p>
                  </div>
                  <Link href="/contador/solicitacoes"
                    className="shrink-0 rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                    Atender
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Últimos clientes */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Clientes</h2>
            <Link href="/contador/clientes" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {subs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum cliente cadastrado.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {subs.slice(0, 5).map(c => {
                const name = displayName(c);
                return (
                  <li key={c.companyId} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{name}</p>
                      <p className="text-xs text-slate-400">{c.planName}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Distribuição de planos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Distribuição por plano</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from(porPlano.entries()).map(([nome, info], i) => (
            <div key={nome} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <span className={`h-2 w-2 rounded-full shrink-0 ${['bg-brand-500', 'bg-violet-500', 'bg-amber-500'][i % 3]}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 dark:text-slate-200">{nome}</p>
                <p className="text-xs text-slate-500">{BRL.format(info.monthlyValue)}/mês</p>
              </div>
              <span className="text-2xl font-semibold text-slate-700 dark:text-slate-300">{info.count}</span>
            </div>
          ))}
          {porPlano.size === 0 && <p className="text-sm text-slate-500">Nenhuma assinatura cadastrada.</p>}
        </div>
      </section>
    </div>
  );
}
