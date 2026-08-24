import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { withTenant, sql } from '@hexxa/db';
import { TaxThermometerService } from '@hexxa/core';
import { FileText, Info, TrendingDown, Scale, Receipt } from 'lucide-react';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

type Entry = { amount: number; type: string; status: string; reference_month: string; description: string | null; category_name: string | null };

type MonthSummary = {
  month: string;
  receita: number;
  despesasOperacionais: number;
  prolabore: number;
  impostoEstimado: number;
  lucroLiquido: number;
};

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function monthLabelShort(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function lastNMonths(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  return out;
}

function summarize(entries: Entry[], effectiveRate: number) {
  const receita = entries.filter((e) => e.type === 'RECEIVABLE').reduce((s, e) => s + Number(e.amount), 0);
  const prolabore = entries
    .filter((e) => e.type === 'PAYABLE' && String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasOperacionais = entries
    .filter((e) => e.type === 'PAYABLE' && !String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const impostoEstimado = receita * (effectiveRate / 100);
  const lucroLiquido = receita - despesasOperacionais - prolabore - impostoEstimado;
  return { receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido };
}

export default async function BalancoInstantaneoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const options = lastNMonths(12);
  const curMonth = options[0]!;
  const oldestMonth = options[options.length - 1]!;
  const de = params.de && options.includes(params.de) ? params.de : curMonth;
  const ate = params.ate && options.includes(params.ate) ? params.ate : curMonth;
  const [deOrdered, ateOrdered] = de <= ate ? [de, ate] : [ate, de];

  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });

  // Lançamentos dos últimos 12 meses (usado tanto no período filtrado quanto
  // no histórico mensal de cada seção — uma query só, filtrada em memória).
  const allEntries = await withTenant(ctx.companyId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT fe.amount, fe.type, fe.status, fe.reference_month, fe.description,
             c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${ctx.companyId}
        AND fe.status != 'CANCELED'
        AND fe.reference_month >= ${oldestMonth}
        AND fe.reference_month <= ${curMonth}
    `);
    return rows as unknown as Entry[];
  });

  const entries = allEntries.filter((e) => e.reference_month >= deOrdered && e.reference_month <= ateOrdered);
  const { receita, prolabore, despesasOperacionais, impostoEstimado, lucroLiquido } = summarize(entries, simples.effectiveRate);
  const despesasTotais = despesasOperacionais + prolabore + impostoEstimado;
  const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

  // despesas por categoria (excluindo pró-labore, que já tem linha própria)
  const byCat = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'PAYABLE') continue;
    if (String(e.description || '').startsWith('Pró-labore')) continue;
    const key = e.category_name?.trim() || 'Sem categoria';
    byCat.set(key, (byCat.get(key) ?? 0) + Number(e.amount));
  }
  const categorias = [...byCat.entries()].sort(([, a], [, b]) => b - a);

  const monthly: MonthSummary[] = [...options]
    .reverse()
    .map((m) => ({ month: m, ...summarize(allEntries.filter((e) => e.reference_month === m), simples.effectiveRate) }));

  const periodoLabel = deOrdered === ateOrdered ? monthLabel(deOrdered) : `${monthLabel(deOrdered)} a ${monthLabel(ateOrdered)}`;
  const hasData = entries.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <style>{`
        @media print {
          .print-scope-balanco #secao-dre { display: none !important; }
          .print-scope-dre #secao-balanco { display: none !important; }
        }
      `}</style>

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FileText className="h-3.5 w-3.5" />
              Balanço e DRE
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight capitalize">
            {periodoLabel}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gerado em tempo real com base nos lançamentos conciliados no sistema.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-center gap-2">
          <select name="de" defaultValue={deOrdered} className="appearance-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]">
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">até</span>
          <select name="ate" defaultValue={ateOrdered} className="appearance-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2 text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C]">
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] transition-all shadow-sm">
            Filtrar
          </button>
        </form>
      </header>

      {/* ===================== Seção: Balanço ===================== */}
      <section id="secao-balanco" className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3] flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="flex items-center gap-2 font-serif font-bold text-xl text-[#DFFFAE]">
              <Scale className="h-5 w-5" /> Balanço
            </h2>
            <p className="text-xs text-[#DFFFAE]/80 mt-1 print:text-slate-600">Resumo executivo do resultado do período</p>
          </div>
          <PrintButton scope="balanco" label="Imprimir Balanço" />
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {!hasData ? (
            <p className="text-center text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12">
              Nenhum lançamento encontrado para {periodoLabel}.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-1 border-l-2 border-[#1E3328] dark:border-[#DFFFAE] pl-4">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Receita Bruta</p>
                <p className="font-serif text-2xl font-bold text-emerald-700 dark:text-emerald-400">{BRL.format(receita)}</p>
              </div>
              <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Despesas Totais</p>
                <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(despesasTotais)}</p>
              </div>
              <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Resultado ({pct(margem)})</p>
                <p className={`font-serif text-2xl font-bold ${lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {BRL.format(lucroLiquido)}
                </p>
              </div>
            </div>
          )}

          <div className="h-px w-full bg-black/5 dark:bg-white/10" />

          <section className="space-y-3">
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Histórico Mensal</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Despesas</th>
                    <th className="py-2 pl-4 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => {
                    const despesasM = m.despesasOperacionais + m.prolabore + m.impostoEstimado;
                    return (
                      <tr key={m.month} className="border-b border-black/5 dark:border-white/10 last:border-0">
                        <td className="py-2.5 pr-4 capitalize text-[#231F20] dark:text-[#FEFDF3]">{monthLabelShort(m.month)}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">{BRL.format(m.receita)}</td>
                        <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(despesasM)}</td>
                        <td className={`py-2.5 pl-4 text-right font-bold ${m.lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {BRL.format(m.lucroLiquido)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {/* ===================== Seção: DRE ===================== */}
      <section id="secao-dre" className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="bg-[#1E3328] px-8 py-6 text-[#FEFDF3] flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="flex items-center gap-2 font-serif font-bold text-xl text-[#DFFFAE]">
              <Receipt className="h-5 w-5" /> DRE
            </h2>
            <p className="text-xs text-[#DFFFAE]/80 mt-1 print:text-slate-600">Demonstrativo de Resultado do Exercício, detalhado por linha</p>
          </div>
          <PrintButton scope="dre" label="Imprimir DRE" />
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {!hasData ? (
            <p className="text-center text-sm text-[#6E6A61] dark:text-[#A8A49C] py-12">
              Nenhum lançamento encontrado para {periodoLabel}. Emita notas ou lance despesas para o DRE aparecer aqui.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-black/5 dark:border-white/10">
                      <td className="py-3.5 font-bold text-[#231F20] dark:text-[#FEFDF3]">Receita Bruta</td>
                      <td className="py-3.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{BRL.format(receita)}</td>
                    </tr>
                    <tr className="border-b border-black/5 dark:border-white/10">
                      <td className="py-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">(−) Despesas operacionais</td>
                      <td className="py-3 text-right text-xs font-semibold text-[#231F20] dark:text-[#FEFDF3]">− {BRL.format(despesasOperacionais)}</td>
                    </tr>
                    <tr className="border-b border-black/5 dark:border-white/10">
                      <td className="py-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">(−) Pró-labore dos sócios</td>
                      <td className="py-3 text-right text-xs font-semibold text-[#231F20] dark:text-[#FEFDF3]">− {BRL.format(prolabore)}</td>
                    </tr>
                    <tr className="border-b border-black/5 dark:border-white/10">
                      <td className="py-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                        (−) Imposto estimado (Simples, {pct(simples.effectiveRate)} efetiva · Anexo {simples.anexo})
                      </td>
                      <td className="py-3 text-right text-xs font-semibold text-[#231F20] dark:text-[#FEFDF3]">− {BRL.format(impostoEstimado)}</td>
                    </tr>
                    <tr>
                      <td className="py-4 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">= Lucro Líquido do Período</td>
                      <td className={`py-4 text-right font-serif text-2xl font-bold ${lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {BRL.format(lucroLiquido)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="flex items-start gap-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C] pt-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Imposto é uma estimativa pela alíquota efetiva atual do Simples Nacional — o valor exato da guia (DAS) é apurado pelo PGDAS oficial da Receita.
                </p>
              </div>

              <div className="h-px w-full bg-black/5 dark:bg-white/10" />

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-1 border-l-2 border-[#1E3328] dark:border-[#DFFFAE] pl-4">
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Margem Líquida</p>
                  <p className={`font-serif text-2xl font-bold ${margem >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{pct(margem)}</p>
                </div>
                <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">Fator R Atual</p>
                  <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{pct(simples.fatorR * 100)}</p>
                  <p className={`text-[11px] font-bold ${simples.fatorRFavorable ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {simples.fatorRFavorable ? 'Anexo III (favorável)' : 'Anexo V'}
                  </p>
                </div>
                <div className="space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-4">
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide">RBT12 (12 meses)</p>
                  <p className="font-serif text-2xl font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(rbt12)}</p>
                </div>
              </div>

              {categorias.length > 0 && (
                <>
                  <div className="h-px w-full bg-black/5 dark:bg-white/10" />
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-2 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">
                      <TrendingDown className="h-4 w-4 text-red-600" /> Despesas por Categoria
                    </h3>
                    <ul className="space-y-2">
                      {categorias.map(([label, value]) => (
                        <li key={label} className="flex items-center justify-between text-sm py-1 border-b border-black/5 dark:border-white/10 last:border-0">
                          <span className="text-[#6E6A61] dark:text-[#A8A49C]">{label}</span>
                          <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </>
          )}

          <div className="h-px w-full bg-black/5 dark:bg-white/10" />

          <section className="space-y-3">
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Histórico Mensal do DRE</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-4">Mês</th>
                    <th className="py-2 px-4 text-right">Receita</th>
                    <th className="py-2 px-4 text-right">Despesas Op.</th>
                    <th className="py-2 px-4 text-right">Pró-labore</th>
                    <th className="py-2 px-4 text-right">Imposto</th>
                    <th className="py-2 pl-4 text-right">Lucro Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b border-black/5 dark:border-white/10 last:border-0">
                      <td className="py-2.5 pr-4 capitalize text-[#231F20] dark:text-[#FEFDF3]">{monthLabelShort(m.month)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">{BRL.format(m.receita)}</td>
                      <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(m.despesasOperacionais)}</td>
                      <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(m.prolabore)}</td>
                      <td className="py-2.5 px-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(m.impostoEstimado)}</td>
                      <td className={`py-2.5 pl-4 text-right font-bold ${m.lucroLiquido >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {BRL.format(m.lucroLiquido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <div className="text-center text-xs text-[#6E6A61] dark:text-[#A8A49C] print:pt-4">
        <p>Hexxa Hub — relatórios gerados automaticamente em {new Date().toLocaleString('pt-BR')}, a partir dos dados já lançados no sistema.</p>
      </div>
    </div>
  );
}
