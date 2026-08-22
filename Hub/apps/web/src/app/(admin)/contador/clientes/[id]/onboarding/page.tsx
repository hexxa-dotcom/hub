import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle, Circle } from '@phosphor-icons/react/dist/ssr';
import { getDb, eq, and, sql } from '@hexxa/db';
import { company, membership, serviceInvoice, financialEntry, subscription } from '@hexxa/db/schema';

export default async function AdminOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [comp] = await db.select().from(company).where(eq(company.id, id));
  if (!comp) notFound();

  const [fiscalRows, ownerRows, invoiceCount, entryCount, [sub]] = await Promise.all([
    db.execute(sql`SELECT cnpj, codigo_municipio FROM nfse_config WHERE company_id = ${id} LIMIT 1`),
    db.select({ id: membership.id }).from(membership).where(and(eq(membership.companyId, id), eq(membership.role, 'OWNER'))),
    db.select({ n: sql<number>`count(*)::int` }).from(serviceInvoice).where(eq(serviceInvoice.companyId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(financialEntry).where(eq(financialEntry.companyId, id)),
    db.select({ status: subscription.status }).from(subscription).where(eq(subscription.companyId, id)),
  ]);

  const fiscalRow = fiscalRows[0] as { cnpj: string | null; codigo_municipio: string | null } | undefined;
  const cadastroCompleto = !comp.cnpj.startsWith('PENDENTE-');
  const fiscalCompleto = Boolean(fiscalRow?.cnpj && fiscalRow?.codigo_municipio);
  const responsavelVinculado = ownerRows.length > 0;
  const primeiraNota = Number(invoiceCount[0]?.n ?? 0) > 0;
  const primeiroLancamento = Number(entryCount[0]?.n ?? 0) > 0;
  const assinaturaAtiva = sub?.status === 'ACTIVE';

  const steps = [
    { label: 'Cadastro da empresa completo', done: cadastroCompleto, hint: 'CNPJ real informado (não é mais um cadastro pendente).' },
    { label: 'Responsável vinculado', done: responsavelVinculado, hint: 'Existe um usuário OWNER associado à empresa.' },
    { label: 'Cadastro fiscal completo', done: fiscalCompleto, hint: 'CNPJ e código do município preenchidos para emitir NFSe.' },
    { label: 'Assinatura ativa', done: assinaturaAtiva, hint: 'Plano contratado e cobrança em dia.' },
    { label: 'Primeiro lançamento financeiro', done: primeiroLancamento, hint: 'Ao menos uma entrada em contas a pagar/receber.' },
    { label: 'Primeira nota fiscal emitida', done: primeiraNota, hint: 'Ao menos uma NFSe registrada para o cliente.' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Onboarding — {comp.legalName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Progresso derivado do que já está preenchido no cadastro, não de um checklist manual.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{doneCount} de {steps.length} etapas concluídas</p>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{pct}%</p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((s) => (
          <div key={s.label} className="flex items-start gap-3 p-4">
            {s.done ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-green-500 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${s.done ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>{s.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
