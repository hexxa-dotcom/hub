export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { marcarContatoAtendido } from './contatos-actions';
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
import { getDb, eq, desc, withDbTimeout, sql } from '@hexxa/db';
import { certificadosDasEmpresas } from '@/lib/server/fiscal';
import { valorDosHonorarios } from '@hexxa/core';
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
          ? 'bg-[#1E3328] text-[#F5F6F4] border border-[#2F4A3C] shadow-lg'
          : 'bg-[#E7EAE5] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 text-[#231F20] dark:text-[#F5F6F4] shadow-sm hover:border-black/10'
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
        <p className={`mt-1.5 text-xs font-medium ${highlight ? 'text-[#F5F6F4]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
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

/**
 * Certificados que pedem ação: vencidos ou vencendo em até 30 dias (a partir
 * de 15 com destaque). Sem certificado a nota não é emitida pela Hexx nem as
 * notas chegam do Emissor Nacional.
 */
/**
 * Clientes com limite de faturamento no plano (Simples Light) que passaram
 * dele nos DOIS últimos meses fechados: é hora de migrar para o completo. O
 * cliente não é bloqueado — faturar mais é sinal de que ele cresceu.
 */
/** Pedidos de contato do site ainda sem atendimento. */
async function contatosDoSite(): Promise<{ id: string; nome: string; email: string; whatsapp: string; area: string | null; quando: string }[]> {
  return (await getDb().execute(sql`
    SELECT id::text, nome, email, whatsapp, area, to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS quando
      FROM contato_do_site WHERE atendido_em IS NULL AND created_at > now() - interval '60 days'
     ORDER BY created_at DESC LIMIT 20
  `)) as unknown as { id: string; nome: string; email: string; whatsapp: string; area: string | null; quando: string }[];
}

/** Contratações feitas no site que ainda não viraram cliente no Hub. */
async function pedidosDoSite(): Promise<{ id: string; nome: string; empresa: string | null; plano: string; cobranca: string; metodo: string; status: string; telefone: string; quando: string }[]> {
  return (await getDb().execute(sql`
    SELECT id::text, nome, razao_social AS empresa, plano, cobranca, metodo, status, telefone,
           to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS quando
      FROM pedido_do_site
     WHERE company_id IS NULL AND status <> 'CANCELADO' AND created_at > now() - interval '60 days'
     ORDER BY (status = 'PAGO') DESC, created_at DESC
     LIMIT 20
  `)) as unknown as { id: string; nome: string; empresa: string | null; plano: string; cobranca: string; metodo: string; status: string; telefone: string; quando: string }[];
}

async function clientesParaMigrarDePlano(): Promise<{ companyId: string; nome: string; plano: string; limite: number; meses: { mes: string; valor: number }[] }[]> {
  const linhas = (await getDb().execute(sql`
    WITH limitados AS (
      SELECT c.id, coalesce(c.trade_name, c.legal_name) AS nome, p.features->>'nomeComercial' AS plano,
             (p.features->>'limiteFaturamentoMes')::numeric AS limite
        FROM company c
        JOIN subscription s ON s.company_id = c.id AND s.status <> 'CANCELED'
        JOIN plan p ON p.id = s.plan_id
       WHERE p.features ? 'limiteFaturamentoMes'
    ), meses AS (
      SELECT generate_series(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '2 months',
                             date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', interval '1 month')::date AS mes
    )
    SELECT l.id::text AS company_id, l.nome, l.plano, l.limite::float, to_char(m.mes, 'MM/YYYY') AS mes,
           coalesce((SELECT sum(e.amount) FROM financial_entry e
                      WHERE e.company_id = l.id AND e.type = 'RECEIVABLE' AND e.status <> 'CANCELED'
                        AND e.source IN ('NFSE', 'DFE_SYNC') AND e.reference_month = m.mes), 0)::float AS valor
      FROM limitados l CROSS JOIN meses m
  `)) as unknown as { company_id: string; nome: string; plano: string; limite: number; mes: string; valor: number }[];
  const porEmpresa = new Map<string, { companyId: string; nome: string; plano: string; limite: number; meses: { mes: string; valor: number }[] }>();
  for (const l of linhas) {
    const e = porEmpresa.get(l.company_id) ?? { companyId: l.company_id, nome: l.nome, plano: l.plano, limite: l.limite, meses: [] };
    e.meses.push({ mes: l.mes, valor: l.valor });
    porEmpresa.set(l.company_id, e);
  }
  return [...porEmpresa.values()].filter((e) => e.meses.length === 2 && e.meses.every((m) => m.valor > e.limite));
}

async function certificadosParaRenovar(): Promise<{ companyId: string; nome: string; validoAte: string; dias: number }[]> {
  const mapa = await certificadosDasEmpresas();
  if (!mapa.size) return [];
  const nomes = (await getDb().execute(
    sql`SELECT id::text, coalesce(nullif(trade_name, ''), legal_name) AS nome FROM company WHERE closed_at IS NULL`,
  )) as unknown as { id: string; nome: string }[];
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return nomes
    .flatMap((n) => {
      const v = mapa.get(n.id)?.validoAte;
      if (!v) return [];
      const dias = Math.round((Date.parse(`${v}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
      return dias <= 30 ? [{ companyId: n.id, nome: n.nome, validoAte: v, dias }] : [];
    })
    .sort((a, b) => a.dias - b.dias);
}

export default async function AdminDashboard() {
  const renovar = await certificadosParaRenovar().catch(() => []);
  const migrar = await clientesParaMigrarDePlano().catch(() => []);
  const pedidos = await pedidosDoSite().catch(() => []);
  const contatos = await contatosDoSite().catch(() => []);
  // Sem timeout aqui essa página já travou o /contador inteiro por até 5
  // minutos quando o pooler do Supabase engasgava (ver client.ts). Se não
  // responder rápido, mostra o painel zerado em vez de pendurar a navegação.
  let subs: { companyId: string; legalName: string; tradeName: string | null; useTradeName: boolean; planName: string; monthlyValue: string; discountValue: string; customValue: string | null; status: string }[] = [];
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
            discountValue: subscription.discountValue,
            customValue: subscription.customValue,
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
  // MRR pelo que de fato é cobrado de cada cliente. Somar o preço de tabela
  // ignorava os descontos combinados e inflava a receita; com o plano
  // Personalizado, cujo preço mora na assinatura, mostraria zero.
  const precoDe = (s: { monthlyValue: string; discountValue: string; customValue: string | null }) =>
    valorDosHonorarios({
      valorDoPlano: Number(s.monthlyValue),
      desconto: s.discountValue,
      valorCombinado: s.customValue,
    });
  const mrr = subs.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + precoDe(s), 0);
  const inadimplentes = subs.filter(s => s.status === 'PAST_DUE').length;
  const trials = subs.filter(s => s.status === 'TRIAL').length;

  // No Personalizado não há "preço do plano" — cada cliente tem o seu, então
  // o painel mostra a média do que esses clientes pagam.
  const porPlano = new Map<string, { count: number; monthlyValue: number }>();
  for (const s of subs) {
    const entry = porPlano.get(s.planName) ?? { count: 0, monthlyValue: 0 };
    entry.count += 1;
    entry.monthlyValue += precoDe(s);
    porPlano.set(s.planName, entry);
  }
  for (const entry of porPlano.values()) {
    entry.monthlyValue = entry.count ? entry.monthlyValue / entry.count : 0;
  }

  const PLAN_COLORS = ['#2F4A3C', '#5F6E46', '#A2C1CD'];

  return (
    <div className="w-full space-y-8 animate-fade-up">
      {/* Header Banner */}
      <div className="rounded-3xl bg-[#E7EAE5] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Painel de Controle Operacional
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#F5F6F4]">
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

      {renovar.length > 0 && (
        <div className={`rounded-3xl border px-6 py-5 ${renovar.some((r) => r.dias <= 15) ? 'border-red-300/60 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30' : 'border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'}`}>
          <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            {renovar.length === 1 ? 'Um certificado digital' : `${renovar.length} certificados digitais`} para renovar
          </p>
          <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Sem certificado válido a nota não sai pela Hexx e as notas do Emissor Nacional param de chegar. Troque na página fiscal do cliente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {renovar.map((r) => (
              <Link
                key={r.companyId}
                href={`/contador/clientes/${r.companyId}/fiscal` as never}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${r.dias < 0 ? 'bg-red-600 text-white' : r.dias <= 15 ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'}`}
              >
                {r.nome} · {r.dias < 0 ? `venceu ${r.validoAte.split('-').reverse().join('/')}` : r.dias === 0 ? 'vence hoje' : `vence em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {contatos.length > 0 && (
        <div className="rounded-3xl border border-black/[0.06] bg-white px-6 py-5 dark:border-white/[0.08] dark:bg-[#121614]">
          <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            {contatos.length === 1 ? 'Um contato pelo site' : `${contatos.length} contatos pelo site`}
          </p>
          <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Pediram diagnóstico ou demonstração. Toque para abrir o WhatsApp.</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {contatos.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-2 rounded-2xl bg-black/[0.03] px-3.5 py-2 text-xs text-[#231F20] dark:bg-white/5 dark:text-[#F5F6F4]">
                <a href={`https://wa.me/55${c.whatsapp}` as never} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">{c.nome}</a>
                <span className="text-[#6E6A61] dark:text-[#A8A49C]">· {c.area ?? 'área não informada'} · {c.email} · {c.quando}</span>
                <form action={marcarContatoAtendido} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-[11px] font-bold text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-white">Atendido ✓</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {pedidos.length > 0 && (
        <div className="rounded-3xl border border-lime-300/70 bg-lime-50 px-6 py-5 dark:border-lime-900/60 dark:bg-lime-950/20">
          <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            {pedidos.length === 1 ? 'Uma contratação pelo site' : `${pedidos.length} contratações pelo site`}
          </p>
          <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Pagas primeiro. Para ativar, cadastre a empresa e convide a pessoa em Acessos (com o CPF). Sem cobrança = o Asaas não gerou; envie o link.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {pedidos.map((p) => (
              <a
                key={p.id}
                href={`https://wa.me/55${p.telefone}` as never}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap items-center gap-x-2 rounded-2xl bg-white/70 px-3.5 py-2 text-xs text-[#231F20] dark:bg-white/5 dark:text-[#F5F6F4]"
              >
                <span className={`rounded-full px-2 py-0.5 font-bold ${p.status === 'PAGO' ? 'bg-lime-200 text-lime-900' : p.status === 'SEM_COBRANCA' ? 'bg-amber-100 text-amber-900' : 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'}`}>
                  {p.status === 'PAGO' ? 'Pago' : p.status === 'SEM_COBRANCA' ? 'Sem cobrança' : 'Aguardando'}
                </span>
                <strong>{p.nome}</strong>
                {p.empresa && <span>· {p.empresa}</span>}
                <span className="text-[#6E6A61] dark:text-[#A8A49C]">· {p.plano} · {p.cobranca === 'anual' ? 'anual' : 'mês a mês'} · {p.metodo} · {p.quando}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {migrar.length > 0 && (
        <div className="rounded-3xl border border-sky-300/60 bg-sky-50 px-6 py-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            {migrar.length === 1 ? 'Um cliente cresceu além do plano' : `${migrar.length} clientes cresceram além do plano`}
          </p>
          <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Faturaram acima do limite do plano nos dois últimos meses. Hora de conversar sobre o plano completo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {migrar.map((m) => (
              <Link
                key={m.companyId}
                href={`/contador/clientes/${m.companyId}` as never}
                className="rounded-full bg-sky-100 px-3.5 py-1.5 text-xs font-bold text-sky-900 dark:bg-sky-900/50 dark:text-sky-200"
              >
                {m.nome} · {m.plano} · {m.meses.map((x) => `${x.mes} ${BRL.format(x.valor)}`).join(' · ')}
              </Link>
            ))}
          </div>
        </div>
      )}

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
        <section className="lg:col-span-3 rounded-3xl border border-black/5 dark:border-white/10 bg-[#E7EAE5] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4 mb-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#F5F6F4]">Solicitações Abertas</h2>
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
                      <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4] truncate">
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
        <section className="lg:col-span-2 rounded-3xl border border-black/5 dark:border-white/10 bg-[#E7EAE5] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4 mb-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#F5F6F4]">Carteira Ativa</h2>
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
                        <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{name}</p>
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
      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#E7EAE5] dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm">
        <div className="mb-5">
          <h2 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#F5F6F4]">Distribuição por Plano de Assinatura</h2>
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
                  <p className="font-bold text-sm text-[#231F20] dark:text-[#F5F6F4] truncate">{nome}</p>
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
