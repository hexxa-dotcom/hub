import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { withTenant, sql } from '@hexxa/db';
import { TaxThermometerService } from '@hexxa/core';
import { FileText, Printer, Info, TrendUp, TrendDown } from '@phosphor-icons/react/dist/ssr';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

type Entry = { amount: number; type: string; status: string; reference_month: string; description: string | null; category_name: string | null };

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
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

export default async function BalancoInstantaneoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const options = lastNMonths(12);
  const curMonth = options[0]!;
  const de = params.de && options.includes(params.de) ? params.de : curMonth;
  const ate = params.ate && options.includes(params.ate) ? params.ate : curMonth;
  const [deOrdered, ateOrdered] = de <= ate ? [de, ate] : [ate, de];

  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });

  const entries = await withTenant(ctx.companyId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT fe.amount, fe.type, fe.status, fe.reference_month, fe.description,
             c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${ctx.companyId}
        AND fe.reference_month >= ${deOrdered}
        AND fe.reference_month <= ${ateOrdered}
    `);
    return rows as unknown as Entry[];
  });

  const receita = entries.filter((e) => e.type === 'RECEIVABLE').reduce((s, e) => s + Number(e.amount), 0);
  const prolabore = entries
    .filter((e) => e.type === 'PAYABLE' && String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesasOperacionais = entries
    .filter((e) => e.type === 'PAYABLE' && !String(e.description || '').startsWith('Pró-labore'))
    .reduce((s, e) => s + Number(e.amount), 0);
  const impostoEstimado = receita * (simples.effectiveRate / 100);
  const lucroLiquido = receita - despesasOperacionais - prolabore - impostoEstimado;
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

  const periodoLabel = deOrdered === ateOrdered ? monthLabel(deOrdered) : `${monthLabel(deOrdered)} a ${monthLabel(ateOrdered)}`;
  const hasData = entries.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-brand-500" />
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Balanço Instantâneo</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink capitalize">{periodoLabel}</h1>
          <p className="mt-0.5 text-xs text-ink-soft">Gerado agora, com o que já está lançado no sistema — não precisa esperar o fechamento do contador.</p>
        </div>

        <form method="get" className="flex flex-wrap items-center gap-2">
          <select name="de" defaultValue={deOrdered} className="appearance-none bg-surface-card border border-line rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-500">
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <span className="text-xs text-ink-soft">até</span>
          <select name="ate" defaultValue={ateOrdered} className="appearance-none bg-surface-card border border-line rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-500">
            {options.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Gerar
          </button>
        </form>
      </header>

      <div className="bg-surface-card rounded-3xl border border-line shadow-xl overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <div className="bg-brand-600 px-8 py-6 text-white flex items-center justify-between print:bg-slate-100 print:text-black print:border-b">
          <div>
            <h2 className="text-xl font-bold">Demonstrativo de Resultado (DRE)</h2>
            <p className="text-brand-100 text-sm mt-1 print:text-slate-600">Calculado ao vivo a partir dos lançamentos do período</p>
          </div>
          <button
            type="button"
            className="hidden sm:flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full backdrop-blur-sm print:hidden text-sm font-bold"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>

        <div className="p-8 space-y-8">
          {!hasData ? (
            <p className="text-center text-sm text-ink-soft py-10">
              Nenhum lançamento encontrado para {periodoLabel}. Emita notas ou lance despesas para o balanço aparecer aqui.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-line">
                      <td className="py-3 font-medium text-ink">Receita Bruta</td>
                      <td className="py-3 text-right font-semibold text-ok">{BRL.format(receita)}</td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="py-3 text-ink-soft">(−) Despesas operacionais</td>
                      <td className="py-3 text-right text-ink">− {BRL.format(despesasOperacionais)}</td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="py-3 text-ink-soft">(−) Pró-labore dos sócios</td>
                      <td className="py-3 text-right text-ink">− {BRL.format(prolabore)}</td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="py-3 text-ink-soft">
                        (−) Imposto estimado (Simples, {pct(simples.effectiveRate)} efetiva · Anexo {simples.anexo})
                      </td>
                      <td className="py-3 text-right text-ink">− {BRL.format(impostoEstimado)}</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-base font-bold text-ink">= Lucro Líquido do Período</td>
                      <td className={`py-4 text-right text-xl font-extrabold ${lucroLiquido >= 0 ? 'text-ok' : 'text-critical'}`}>
                        {BRL.format(lucroLiquido)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="flex items-start gap-1.5 text-[11px] text-ink-soft pt-1">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Imposto é uma estimativa pela alíquota efetiva atual do Simples Nacional — o valor exato da guia (DAS) é apurado pelo PGDAS oficial.
                </p>
              </div>

              <div className="h-px w-full bg-line" />

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-1 border-l-2 border-brand-500 pl-4">
                  <p className="text-sm text-ink-soft font-medium">Margem líquida</p>
                  <p className={`text-2xl font-bold ${margem >= 0 ? 'text-ok' : 'text-critical'}`}>{pct(margem)}</p>
                </div>
                <div className="space-y-1 border-l-2 border-line pl-4">
                  <p className="text-sm text-ink-soft font-medium">Fator R atual</p>
                  <p className="text-2xl font-bold text-ink">{pct(simples.fatorR * 100)}</p>
                  <p className={`text-xs font-medium ${simples.fatorRFavorable ? 'text-ok' : 'text-warn'}`}>
                    {simples.fatorRFavorable ? 'Anexo III (favorável)' : 'Anexo V'}
                  </p>
                </div>
                <div className="space-y-1 border-l-2 border-line pl-4">
                  <p className="text-sm text-ink-soft font-medium">RBT12 (12 meses)</p>
                  <p className="text-2xl font-bold text-ink">{BRL.format(rbt12)}</p>
                </div>
              </div>

              {categorias.length > 0 && (
                <>
                  <div className="h-px w-full bg-line" />
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-2 font-bold text-sm text-ink">
                      <TrendDown className="h-4 w-4 text-critical" /> Despesas por categoria
                    </h3>
                    <ul className="space-y-2">
                      {categorias.map(([label, value]) => (
                        <li key={label} className="flex items-center justify-between text-sm">
                          <span className="text-ink-soft">{label}</span>
                          <span className="font-medium text-ink">{BRL.format(value)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </>
          )}

          <div className="mt-4 text-center pt-6 border-t border-line text-xs text-ink-soft print:pt-4">
            <p>Hexxa Hub — Balanço gerado automaticamente em {new Date().toLocaleString('pt-BR')}, a partir dos dados já lançados no sistema.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
