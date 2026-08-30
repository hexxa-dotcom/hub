export const dynamic = 'force-dynamic';
import Link from 'next/link';
import {
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  DollarSign,
  Building2,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { getDb, eq, desc, withDbTimeout } from '@hexxa/db';
import { company, subscription, plan, ticket } from '@hexxa/db/schema';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function KPICard({
  icon,
  label,
  value,
  sub,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 transition-all duration-300 ${
        highlight
          ? 'bg-[#1E3328] text-[#FEFDF3] border border-[#2F4A3C] shadow-lg'
          : 'bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 text-[#231F20] dark:text-[#FEFDF3] shadow-sm hover:border-black/10'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-bold uppercase tracking-wider ${highlight ? 'text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
          {label}
        </p>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
            highlight ? 'bg-[#2F4A3C] text-[#DFFFAE]' : 'bg-black/5 dark:bg-white/10 text-[#2F4A3C] dark:text-[#DFFFAE]'
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl sm:text-4xl font-serif font-bold tracking-tight tabular">{value}</p>
      {sub && (
        <p className={`mt-1.5 text-xs font-medium ${highlight ? 'text-[#FEFDF3]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

const PRIORIDADE_CLS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200',
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200',
  LOW: 'bg-black/5 text-[#6E6A61] dark:bg-white/5 dark:text-[#A8A49C]',
};
const PRIORIDADE_LABEL: Record<string, string> = { URGENT: '⚡ Urgente', HIGH: '⚡ Alta', MEDIUM: '○ Média', LOW: '· Baixa' };

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE] border border-[#DFFFAE]',
  TRIAL: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200',
  PAST_DUE: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200',
  CANCELED: 'bg-black/5 text-[#6E6A61]',
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'ativo', TRIAL: 'trial', PAST_DUE: 'inadimplente', CANCELED: 'cancelado' };

function displayName(c: { legalName: string; tradeName: string | null; useTradeName: boolean }) {
  return c.useTradeName && c.tradeName ? c.tradeName : c.legalName;
}

export default async function AdminDashboard() {
  // Sem timeout aqui essa página já travou o /contador inteiro por até 5
  // minutos quando o pooler do Supabase engasgava (ver client.ts). Se não
  // responder rápido, mostra o painel zerado em vez de pendurar a navegação.
  let subs: { companyId: string; legalName: string; tradeName: string | null; useTradeName: boolean; planName: string; monthlyValue: string; status: string }[] = [];
  let openTickets: { id: string; subject: string; priority: string; createdAt: Date; companyName: string; companyTradeName: string | null; companyUseTrade: boolean }[] = [];
  try {
    const db = getDb();
    [subs, openTickets] = await withDbTimeout(
      Promise.all([
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
      ]),
      8000,
    );
  } catch (err) {
    console.error('[AdminDashboard] falha ao carregar dados:', err);
  }

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

  const PLAN_COLORS = ['#2F4A3C', '#5F6E46', '#A2C1CD'];

  return (
    <div className="w-full space-y-8 animate-fade-up">
      {/* Header Banner */}
      <div className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Painel de Controle Operacional
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Visão Geral do Escritório
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-2xl">
              Gestão de carteira de clientes, solicitações de suporte em tempo real e receita recorrente (MRR) — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link
            href="/contador/clientes/novo"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-3 text-xs sm:text-sm font-bold text-[#DFFFAE] shadow-md transition-all hover:scale-105 shrink-0"
          >
            + Novo Cliente
          </Link>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
        <KPICard
          highlight
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita MRR"
          value={BRL.format(mrr)}
          sub="mensal recorrente ativa"
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          label="Clientes Ativos"
          value={String(ativos)}
          sub={`${trials} empresas em trial`}
        />
        <KPICard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Inadimplentes"
          value={String(inadimplentes)}
          sub="Requer ação comercial"
        />
        <KPICard
          icon={<Clock className="h-5 w-5" />}
          label="Solicitações Abertas"
          value={String(openTickets.length)}
          sub="Aguardando retorno do time"
        />
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Solicitações abertas */}
        <section className="lg:col-span-3 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4 mb-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">Solicitações Abertas</h2>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Atendimentos e dúvidas pendentes dos clientes</p>
              </div>
              <Link href="/contador/solicitacoes" className="flex items-center gap-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {openTickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
                <CheckCircle2 className="h-10 w-10 mx-auto text-[#2F4A3C] dark:text-[#DFFFAE] mb-2" />
                Nenhuma solicitação em aberto no momento. Tudo em dia!
              </div>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {openTickets.map(t => (
                  <li key={t.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${PRIORIDADE_CLS[t.priority]}`}>
                          {PRIORIDADE_LABEL[t.priority]}
                        </span>
                        <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate">
                        {t.companyUseTrade && t.companyTradeName ? t.companyTradeName : t.companyName}
                      </p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] line-clamp-1">{t.subject}</p>
                    </div>
                    <Link
                      href="/contador/solicitacoes"
                      className="shrink-0 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] px-4 py-1.5 text-xs font-bold transition-transform hover:scale-105 shadow-sm"
                    >
                      Atender
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Últimos clientes */}
        <section className="lg:col-span-2 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4 mb-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">Carteira Ativa</h2>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Últimas empresas registradas</p>
              </div>
              <Link href="/contador/clientes" className="flex items-center gap-1 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {subs.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum cliente cadastrado.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {subs.slice(0, 5).map(c => {
                  const name = displayName(c);
                  return (
                    <li key={c.companyId} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#2F4A3C] text-xs font-bold text-[#DFFFAE]">
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{name}</p>
                        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.planName}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${STATUS_CLS[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Distribuição de planos */}
      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm">
        <div className="mb-5">
          <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">Distribuição por Plano de Assinatura</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Volume de clientes e receita mensal por modalidade contratada</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {Array.from(porPlano.entries()).map(([nome, info], i) => (
            <div
              key={nome}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 p-5 transition-all hover:border-black/10"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-3.5 w-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] truncate">{nome}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(info.monthlyValue)}/mês</p>
                </div>
              </div>
              <span className="text-3xl font-serif font-bold text-[#2F4A3C] dark:text-[#DFFFAE] shrink-0">{info.count}</span>
            </div>
          ))}
          {porPlano.size === 0 && <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhuma assinatura cadastrada.</p>}
        </div>
      </section>
    </div>
  );
}
