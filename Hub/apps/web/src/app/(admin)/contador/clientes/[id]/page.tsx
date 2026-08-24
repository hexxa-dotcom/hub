export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  User,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  DollarSign,
  BarChart3,
  Send,
  Clock,
  Receipt,
} from 'lucide-react';
import { getDb, eq, and, desc, sql } from '@hexxa/db';
import { company, appUser, membership, subscription, plan, ticket, accountingInvoice } from '@hexxa/db/schema';
import { ClienteStatusActions } from './ClienteStatusActions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type SubStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED';

const STATUS_CFG: Record<SubStatus, { label: string; cls: string; dot: string }> = {
  ACTIVE:   { label: 'Ativo',        cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  TRIAL:    { label: 'Trial',        cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',         dot: 'bg-blue-500' },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-500/10 text-red-700 dark:text-red-400',           dot: 'bg-red-500' },
  CANCELED: { label: 'Cancelado',    cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', dot: 'bg-[#6E6A61]' },
};

const REGIME_LABEL: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
};

const INVOICE_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Pago', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  OPEN: { label: 'Em aberto', cls: 'bg-amber-500/10 text-amber-700 dark:amber-400' },
  OVERDUE: { label: 'Atrasado', cls: 'bg-red-500/10 text-red-700 dark:text-red-400' },
};

function fmtDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  const db = getDb();

  const [comp] = await db.select().from(company).where(eq(company.id, companyId));
  if (!comp) notFound();

  const [[sub], [owner], openTickets, invoices, [fiscalContact]] = await Promise.all([
    db
      .select({
        subscriptionId: subscription.id,
        status: subscription.status,
        planName: plan.name,
        monthlyValue: plan.monthlyValue,
        asaasCustomerId: subscription.asaasCustomerId,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
      })
      .from(subscription)
      .leftJoin(plan, eq(subscription.planId, plan.id))
      .where(eq(subscription.companyId, companyId))
      .limit(1),
    db
      .select({ name: appUser.name, email: appUser.email })
      .from(appUser)
      .innerJoin(membership, eq(membership.userId, appUser.id))
      .where(and(eq(membership.companyId, companyId), eq(membership.role, 'OWNER')))
      .limit(1),
    db
      .select({ id: ticket.id, subject: ticket.subject, priority: ticket.priority, createdAt: ticket.createdAt })
      .from(ticket)
      .where(and(eq(ticket.companyId, companyId), eq(ticket.status, 'OPEN')))
      .orderBy(desc(ticket.createdAt)),
    db
      .select({
        id: accountingInvoice.id,
        referenceMonth: accountingInvoice.referenceMonth,
        dueDate: accountingInvoice.dueDate,
        value: accountingInvoice.value,
        status: accountingInvoice.status,
      })
      .from(accountingInvoice)
      .where(eq(accountingInvoice.companyId, companyId))
      .orderBy(desc(accountingInvoice.referenceMonth))
      .limit(6),
    db.execute(sql`SELECT email, telefone FROM nfse_config WHERE company_id = ${companyId} LIMIT 1`).then((r) => (r as unknown as Record<string, unknown>[]) ?? []),
  ]);

  const status = (sub?.status as SubStatus) || 'TRIAL';
  const st = STATUS_CFG[status] ?? STATUS_CFG.TRIAL;
  const mrr = sub ? Number(sub.monthlyValue) : 0;
  const email = (fiscalContact?.email as string | null) || owner?.email || null;
  const telefone = (fiscalContact?.telefone as string | null) || null;

  const totalFaturado = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.value), 0);
  const meses = Math.max(
    0,
    (new Date().getFullYear() - comp.createdAt.getFullYear()) * 12 + (new Date().getMonth() - comp.createdAt.getMonth()),
  );

  const kpis = [
    { label: 'MRR atual', value: mrr > 0 ? BRL.format(mrr) : '—', sub: sub ? `Plano ${sub.planName}` : 'Sem assinatura', icon: DollarSign, color: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Total faturado', value: totalFaturado > 0 ? BRL.format(totalFaturado) : '—', sub: `${invoices.filter((i) => i.status === 'PAID').length} fatura(s) paga(s)`, icon: BarChart3, color: 'text-[#2F4A3C] dark:text-[#DFFFAE]' },
    { label: 'Cliente desde', value: meses > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '< 1 mês', sub: fmtDate(comp.createdAt), icon: Calendar, color: 'text-purple-700 dark:text-purple-400' },
    { label: 'Solicitações abertas', value: String(openTickets.length), sub: openTickets.length > 0 ? 'aguardando resposta' : 'tudo em dia', icon: AlertTriangle, color: openTickets.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-[#6E6A61] dark:text-[#A8A49C]' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/contador/clientes"
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">{comp.legalName}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {openTickets.length > 0 && (
              <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                {openTickets.length} pendência{openTickets.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">
            {comp.tradeName || comp.legalName} · CNPJ {comp.cnpj}
            {comp.city && comp.state ? ` · ${comp.city}/${comp.state}` : ''}
          </p>
        </div>
        {email && (
          <div className="flex gap-2 shrink-0">
            <a href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
              <Send className="h-3.5 w-3.5" /> E-mail
            </a>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`font-serif font-bold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — dados + histórico */}
        <div className="lg:col-span-2 space-y-6">

          {/* Dados da empresa */}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
              <Building2 className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Dados da empresa
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:text-sm">
              {[
                ['Razão social', comp.legalName],
                ['Nome fantasia', comp.tradeName || '—'],
                ['CNPJ', comp.cnpj],
                ['Insc. municipal', comp.municipalRegistration || '—'],
                ['Regime tributário', REGIME_LABEL[comp.taxRegime] ?? comp.taxRegime],
                ['Município', comp.city && comp.state ? `${comp.city}/${comp.state}` : '—'],
                ['Endereço', comp.addressLine1 ? `${comp.addressLine1}, ${comp.addressNumber ?? 's/n'} — ${comp.neighborhood ?? ''}` : '—'],
                ['CEP', comp.zipcode || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{k}</p>
                  <p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contato */}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
              <User className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Contato responsável
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                <User className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C] shrink-0" />
                <div>
                  <p className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider font-bold">Responsável</p>
                  <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">{owner?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                <Mail className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C] shrink-0" />
                <div>
                  <p className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider font-bold">E-mail</p>
                  {email ? (
                    <a href={`mailto:${email}`} className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE] break-all">{email}</a>
                  ) : (
                    <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                <Phone className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C] shrink-0" />
                <div>
                  <p className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider font-bold">Telefone</p>
                  <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">{telefone || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de faturas (honorários contábeis) */}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
              <BarChart3 className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Faturas de honorários
            </h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mb-4">
              {invoices.length > 0 ? `Últimas ${invoices.length} fatura(s) geradas no fechamento mensal` : 'Ainda sem faturas geradas'}
            </p>

            {invoices.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Sem histórico — a primeira fatura aparece aqui após o fechamento mensal processar esta empresa.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614]">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10">
                      <th className="px-4 py-3 text-left font-bold text-[#6E6A61] dark:text-[#A8A49C]">Referência</th>
                      <th className="px-4 py-3 text-left font-bold text-[#6E6A61] dark:text-[#A8A49C]">Vencimento</th>
                      <th className="px-4 py-3 text-right font-bold text-[#6E6A61] dark:text-[#A8A49C]">Valor</th>
                      <th className="px-4 py-3 text-right font-bold text-[#6E6A61] dark:text-[#A8A49C]">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/10">
                    {invoices.map((inv) => {
                      const ist = INVOICE_STATUS_CFG[inv.status] ?? INVOICE_STATUS_CFG.OPEN!;
                      return (
                        <tr key={inv.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-[#231F20] dark:text-[#FEFDF3] font-medium capitalize">
                            {new Date(`${inv.referenceMonth}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-[#6E6A61] dark:text-[#A8A49C]">{fmtDate(inv.dueDate)}</td>
                          <td className="px-4 py-3 text-right font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(Number(inv.value))}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ist.cls}`}>
                              {ist.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black/5 dark:bg-white/5 font-bold">
                      <td className="px-4 py-3 text-[#6E6A61] dark:text-[#A8A49C]">Total pago</td>
                      <td />
                      <td className="px-4 py-3 text-right text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(totalFaturado)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — sidebar */}
        <div className="space-y-6">
          {/* Plano */}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">
              <CreditCard className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Plano contratado
            </h2>
            {sub ? (
              <div className="rounded-2xl bg-[#EFFFD6] dark:bg-[#2F4A3C]/30 border border-[#2F4A3C]/20 p-4">
                <p className="text-sm font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{sub.planName}</p>
                <p className="text-xs font-medium text-[#2F4A3C]/80 dark:text-[#DFFFAE]/80">{BRL.format(Number(sub.monthlyValue))}/mês</p>
              </div>
            ) : (
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Sem assinatura vinculada.</p>
            )}
            {sub?.asaasSubscriptionId && (
              <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Cobrança via Asaas ativa
              </div>
            )}
            <div className="mt-4">
              <Link href="/contador/clientes" className="text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                Alterar plano / status na lista de clientes →
              </Link>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
            <h2 className="mb-3 font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Ações rápidas</h2>
            <div className="space-y-1.5">
              <Link href="/contador/solicitacoes"
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <Clock className="h-4 w-4 opacity-70" /> Ver solicitações
              </Link>
              <Link href="/contador/notas"
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <FileText className="h-4 w-4 opacity-70" /> Ver notas fiscais
              </Link>
              <Link href="/contador/contratos"
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <FileText className="h-4 w-4 opacity-70" /> Gerar contrato
              </Link>
              <Link href={`/contador/clientes/${comp.id}/fiscal`}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <BarChart3 className="h-4 w-4 opacity-70" /> Gestão fiscal (PGDAS)
              </Link>
              <Link href={`/contador/clientes/${comp.id}/guias`}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <Receipt className="h-4 w-4 opacity-70" /> Guias &amp; parcelamentos
              </Link>
              <Link href={`/contador/clientes/${comp.id}/onboarding`}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <CheckCircle2 className="h-4 w-4 opacity-70" /> Ver onboarding
              </Link>
              <Link href={`/contador/clientes/${comp.id}/atividade`}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:bg-white/10 dark:hover:text-[#FEFDF3] transition-colors">
                <Clock className="h-4 w-4 opacity-70" /> Ver atividade
              </Link>
              {sub && (status === 'PAST_DUE' || status === 'TRIAL') && (
                <div className="pt-2">
                  <ClienteStatusActions subscriptionId={sub.subscriptionId} status={status} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
