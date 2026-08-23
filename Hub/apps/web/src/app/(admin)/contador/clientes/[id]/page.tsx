export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Buildings, EnvelopeSimple, Phone, User, FileText, CreditCard,
  CheckCircle, WarningCircle, Calendar, CurrencyDollar, ChartBar,
  PaperPlaneRight, Clock,
} from '@phosphor-icons/react/dist/ssr';
import { getDb, eq, and, desc, sql } from '@hexxa/db';
import { company, appUser, membership, subscription, plan, ticket, accountingInvoice } from '@hexxa/db/schema';
import { ClienteStatusActions } from './ClienteStatusActions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type SubStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED';

const STATUS_CFG: Record<SubStatus, { label: string; cls: string; dot: string }> = {
  ACTIVE:   { label: 'Ativo',        cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  TRIAL:    { label: 'Trial',        cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   dot: 'bg-blue-500' },
  PAST_DUE: { label: 'Inadimplente', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',       dot: 'bg-red-500' },
  CANCELED: { label: 'Cancelado',    cls: 'bg-slate-100 text-slate-500',                                        dot: 'bg-slate-400' },
};

const REGIME_LABEL: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
};

const INVOICE_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Pago', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  OPEN: { label: 'Em aberto', cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  OVERDUE: { label: 'Atrasado', cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
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
      .innerJoin(plan, eq(subscription.planId, plan.id))
      .where(eq(subscription.companyId, companyId)),
    db
      .select({ name: appUser.name, email: appUser.email })
      .from(membership)
      .innerJoin(appUser, eq(membership.userId, appUser.id))
      .where(and(eq(membership.companyId, companyId), eq(membership.role, 'OWNER'))),
    db.select({ id: ticket.id }).from(ticket).where(and(eq(ticket.companyId, companyId), eq(ticket.status, 'OPEN'))),
    db
      .select()
      .from(accountingInvoice)
      .where(eq(accountingInvoice.companyId, companyId))
      .orderBy(desc(accountingInvoice.referenceMonth))
      .limit(12),
    db.execute(sql`SELECT email_contato AS email, telefone FROM nfse_config WHERE company_id = ${companyId} LIMIT 1`),
  ]);

  const status: SubStatus = (sub?.status as SubStatus) ?? 'CANCELED';
  const st = STATUS_CFG[status];
  const mrr = sub && status === 'ACTIVE' ? Number(sub.monthlyValue) : 0;
  const email = (fiscalContact?.email as string | null) || owner?.email || null;
  const telefone = (fiscalContact?.telefone as string | null) || null;

  const totalFaturado = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.value), 0);
  const meses = Math.max(
    0,
    (new Date().getFullYear() - comp.createdAt.getFullYear()) * 12 + (new Date().getMonth() - comp.createdAt.getMonth()),
  );

  const kpis = [
    { label: 'MRR atual', value: mrr > 0 ? BRL.format(mrr) : '—', sub: sub ? `Plano ${sub.planName}` : 'Sem assinatura', icon: CurrencyDollar, color: 'text-green-600 dark:text-green-400' },
    { label: 'Total faturado', value: totalFaturado > 0 ? BRL.format(totalFaturado) : '—', sub: `${invoices.filter((i) => i.status === 'PAID').length} fatura(s) paga(s)`, icon: ChartBar, color: 'text-brand-600 dark:text-brand-400' },
    { label: 'Cliente desde', value: meses > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '< 1 mês', sub: fmtDate(comp.createdAt), icon: Calendar, color: 'text-violet-600 dark:text-violet-400' },
    { label: 'Solicitações abertas', value: String(openTickets.length), sub: openTickets.length > 0 ? 'aguardando resposta' : 'tudo em dia', icon: WarningCircle, color: openTickets.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/contador/clientes"
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{comp.legalName}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {openTickets.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {openTickets.length} pendência{openTickets.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {comp.tradeName || comp.legalName} · CNPJ {comp.cnpj}
            {comp.city && comp.state ? ` · ${comp.city}/${comp.state}` : ''}
          </p>
        </div>
        {email && (
          <div className="flex gap-2 shrink-0">
            <a href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
              <PaperPlaneRight className="h-3.5 w-3.5" /> E-mail
            </a>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left — dados + histórico */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dados da empresa */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Buildings className="h-4 w-4 text-slate-400" /> Dados da empresa
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
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
                  <p className="text-xs text-slate-400">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contato */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <User className="h-4 w-4 text-slate-400" /> Contato responsável
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Responsável (OWNER)</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{owner?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <EnvelopeSimple className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">E-mail</p>
                  {email ? (
                    <a href={`mailto:${email}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400 break-all">{email}</a>
                  ) : (
                    <p className="text-sm font-medium text-slate-400">—</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Telefone</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{telefone || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de faturas (honorários contábeis) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <ChartBar className="h-4 w-4 text-slate-400" /> Faturas de honorários
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {invoices.length > 0 ? `Últimas ${invoices.length} fatura(s) geradas no fechamento mensal` : 'Ainda sem faturas geradas'}
            </p>

            {invoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Sem histórico — a primeira fatura aparece aqui após o fechamento mensal processar esta empresa.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Referência</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Vencimento</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Valor</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoices.map((inv) => {
                      const ist = INVOICE_STATUS_CFG[inv.status] ?? INVOICE_STATUS_CFG.OPEN!;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 capitalize">
                            {new Date(`${inv.referenceMonth}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{fmtDate(inv.dueDate)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">{BRL.format(Number(inv.value))}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ist.cls}`}>
                              {ist.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">Total pago</td>
                      <td />
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800 dark:text-slate-200">{BRL.format(totalFaturado)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — sidebar */}
        <div className="space-y-4">
          {/* Plano */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CreditCard className="h-4 w-4 text-slate-400" /> Plano contratado
            </h2>
            {sub ? (
              <div className="rounded-xl bg-brand-500/10 ring-1 ring-brand-400/40 px-3 py-2.5">
                <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">{sub.planName}</p>
                <p className="text-xs text-brand-600 dark:text-brand-400">{BRL.format(Number(sub.monthlyValue))}/mês</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sem assinatura vinculada.</p>
            )}
            {sub?.asaasSubscriptionId && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Cobrança via Asaas ativa
              </div>
            )}
            <div className="mt-3">
              <Link href="/contador/clientes" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                Alterar plano / status na lista de clientes →
              </Link>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Ações rápidas</h2>
            <div className="space-y-2">
              <Link href="/contador/solicitacoes"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <Clock className="h-4 w-4 text-slate-400" /> Ver solicitações
              </Link>
              <Link href="/contador/notas"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <FileText className="h-4 w-4 text-slate-400" /> Ver notas fiscais
              </Link>
              <Link href="/contador/contratos"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <FileText className="h-4 w-4 text-slate-400" /> Gerar contrato
              </Link>
              <Link href={`/contador/clientes/${comp.id}/fiscal`}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <ChartBar className="h-4 w-4 text-slate-400" /> Gestão fiscal (PGDAS)
              </Link>
              <Link href={`/contador/clientes/${comp.id}/onboarding`}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <CheckCircle className="h-4 w-4 text-slate-400" /> Ver onboarding
              </Link>
              <Link href={`/contador/clientes/${comp.id}/atividade`}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                <Clock className="h-4 w-4 text-slate-400" /> Ver atividade
              </Link>
              {sub && (status === 'PAST_DUE' || status === 'TRIAL') && (
                <ClienteStatusActions subscriptionId={sub.subscriptionId} status={status} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
