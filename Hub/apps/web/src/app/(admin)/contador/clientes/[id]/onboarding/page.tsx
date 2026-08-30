export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { getDb, eq, and, sql, withDbTimeout } from '@hexxa/db';
import { company, membership, serviceInvoice, financialEntry, subscription } from '@hexxa/db/schema';

export default async function AdminOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [comp] = await withDbTimeout(db.select().from(company).where(eq(company.id, id)), 8000);
  if (!comp) notFound();

  let fiscalRows: any[] = [];
  let ownerRows: { id: string }[] = [];
  let invoiceCount: { n: number }[] = [];
  let entryCount: { n: number }[] = [];
  let sub: { status: string } | undefined;
  try {
    let subRows: { status: string }[];
    [fiscalRows, ownerRows, invoiceCount, entryCount, subRows] = await withDbTimeout(
      Promise.all([
        db.execute(sql`SELECT cnpj, codigo_municipio FROM nfse_config WHERE company_id = ${id} LIMIT 1`),
        db.select({ id: membership.id }).from(membership).where(and(eq(membership.companyId, id), eq(membership.role, 'OWNER'))),
        db.select({ n: sql<number>`count(*)::int` }).from(serviceInvoice).where(eq(serviceInvoice.companyId, id)),
        db.select({ n: sql<number>`count(*)::int` }).from(financialEntry).where(eq(financialEntry.companyId, id)),
        db.select({ status: subscription.status }).from(subscription).where(eq(subscription.companyId, id)),
      ]),
      8000,
    );
    sub = subRows[0];
  } catch (err) {
    console.error('[AdminOnboardingPage] falha ao carregar progresso de onboarding:', err);
  }

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
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3]">Onboarding — {comp.legalName}</h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Progresso derivado do que já está preenchido no cadastro, não de um checklist manual.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{doneCount} de {steps.length} etapas concluídas</p>
          <p className="font-serif font-bold text-base text-[#2F4A3C] dark:text-[#DFFFAE]">{pct}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 p-0.5">
          <div className="h-full rounded-full bg-[#1E3328] dark:bg-[#DFFFAE] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md divide-y divide-black/5 dark:divide-white/10 overflow-hidden shadow-sm">
        {steps.map((s) => (
          <div key={s.label} className="flex items-start gap-3.5 p-5">
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-[#6E6A61]/40 dark:text-[#A8A49C]/40 mt-0.5" />
            )}
            <div>
              <p className={`text-xs sm:text-sm font-bold ${s.done ? 'text-[#231F20] dark:text-[#FEFDF3]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>{s.label}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">{s.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

