import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { Card } from '@/components/ui/Card';
import { ChunkyBarChart } from './ChunkyBarChart';
import { HalfDonutGauge } from './HalfDonutGauge';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Mês no formato `YYYY-MM-01`, deslocado por `offset` meses a partir de hoje. */
function mesRef(offset: number) {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`;
}

/** "SET", "OUT" — rótulo curto para o eixo. */
function rotuloMes(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase();
}

/**
 * Bento Grid principal da tela inicial do Hub (/cliente), alinhado ao padrão
 * visual do Donezo com card de destaque, botões circulares e barras em cápsula.
 */
export async function MesHero({ selectedMonth }: { selectedMonth?: string } = {}) {
  const meses = Array.from({ length: 6 }, (_, i) => {
    if (!selectedMonth) return mesRef(i - 5);
    const parts = selectedMonth.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '9', 10);
    const d = new Date(y, m - 1 + (i - 5), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const atual = meses[5]!;
  const anterior = meses[4]!;

  let serie: number[] = [];
  let despesas = 0;
  let despesasAnt = 0;
  let provisao = 0;
  let saldoAnt = 0;

  try {
    const ctx = await getTenantContext();
    const linhas = await withTenant(ctx.companyId, async (tx) =>
      tx.execute(sql`
        SELECT
          to_char(reference_month, 'YYYY-MM-DD') AS mes,
          COALESCE(SUM(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS receita,
          COALESCE(SUM(amount) FILTER (WHERE type = 'PAYABLE'), 0)    AS despesa,
          COALESCE(SUM(amount) FILTER (
            WHERE type = 'PAYABLE' AND description ILIKE '%Provisão de Imposto%'), 0) AS provisao
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND status != 'CANCELED'
          AND reference_month >= ${meses[0]!}::date
          AND reference_month <= ${atual}::date
        GROUP BY 1
      `),
    );

    const porMes = new Map(
      (linhas as unknown as Record<string, unknown>[]).map((r) => [
        String(r.mes),
        {
          receita: Number(r.receita ?? 0),
          despesa: Number(r.despesa ?? 0),
          provisao: Number(r.provisao ?? 0),
        },
      ]),
    );

    serie = meses.map((m) => porMes.get(m)?.receita ?? 0);
    const cur = porMes.get(atual);
    const ant = porMes.get(anterior);
    despesas = cur?.despesa ?? 0;
    provisao = cur?.provisao ?? 0;
    despesasAnt = ant?.despesa ?? 0;
    saldoAnt = (ant?.receita ?? 0) - (ant?.despesa ?? 0);
  } catch (err) {
    console.error('[cliente/MesHero] falha ao carregar totais do mês:', err);
  }

  const faturamento = serie[5] ?? 0;
  const faturamentoAnt = serie[4] ?? 0;
  const saldo = faturamento - despesas;

  const variacao = (atualVal: number, antVal: number) =>
    antVal > 0 ? (atualVal - antVal) / antVal : null;

  const tendencia = variacao(faturamento, faturamentoAnt);
  const tendenciaDesp = variacao(despesas, despesasAnt);
  const temSerie = serie.some((v) => v > 0);
  const margem = faturamento > 0 ? Math.round((saldo / faturamento) * 100) : 0;

  // Itens para o gráfico Chunky com padrão hachurado diagonal estilo Donezo
  const chunkyItems = meses.map((m, i) => {
    const isCurrent = i === meses.length - 1;
    return {
      label: rotuloMes(m),
      value: serie[i] ?? 0,
      formattedValue: BRL.format(serie[i] ?? 0),
      isHighlight: isCurrent,
      pattern: isCurrent
        ? ('solid' as const)
        : i % 2 === 0
        ? ('hatched' as const)
        : ('muted' as const),
    };
  });

  return (
    <div className="space-y-6">
      {/* ── 4 Top Cards (Estilo Donezo com Card 1 em destaque escuro) ───────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Destaque Obsidian translúcido com número em Limão */}
        <div data-card="true" className="relative overflow-hidden rounded-[28px] backdrop-blur-xl bg-[#0A0D0B]/85 dark:bg-[#0A0D0B]/75 p-5 sm:p-6 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-emerald-500/20 ring-1 ring-inset ring-white/10 flex flex-col justify-between group transition-all hover:scale-[1.01]">
          {/* Brilho verde sutil atmosférico no card */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[#D4FF00]/15 blur-2xl atmospheric-glow" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-white/70">Faturamento do Mês</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl font-extrabold text-[#D4FF00] tabular tracking-tight">
                {BRL.format(faturamento)}
              </p>
            </div>
            {/* Botão circular estilo Salesforce */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[#D4FF00] shadow-sm backdrop-blur-sm group-hover:bg-[#D4FF00] group-hover:text-black transition-all">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {tendencia !== null && tendencia !== 0 ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                tendencia >= 0
                  ? 'bg-[#D4FF00]/20 text-[#D4FF00]'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {tendencia >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pct(Math.abs(tendencia))}
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/80">
                Estável
              </span>
            )}
            <span className="text-xs text-white/70">vs. mês anterior</span>
          </div>
        </div>

        {/* Card 2: Despesas do Mês (Card Translúcido) */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Despesas do Mês</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-ink tabular tracking-tight">
                {BRL.format(despesas)}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-ink-soft">
            {tendenciaDesp !== null && tendenciaDesp !== 0 ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                tendenciaDesp <= 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
              }`}>
                {tendenciaDesp > 0 ? '↑' : '↓'} {pct(Math.abs(tendenciaDesp))}
              </span>
            ) : (
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                Orçado
              </span>
            )}
            <span>Provisão: {BRL.format(provisao)}</span>
          </div>
        </Card>

        {/* Card 3: Saldo Líquido (Card Translúcido) */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Saldo Líquido</p>
              <p className={`mt-2 font-serif text-2xl sm:text-3xl font-bold tabular tracking-tight ${saldo >= 0 ? 'text-ink' : 'text-expense'}`}>
                {BRL.format(saldo)}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Em dia
            </span>
            <span>Margem de {margem}%</span>
          </div>
        </Card>

        {/* Card 4: Sobra Estimada (Card Translúcido com badge) */}
        <Card level={1} className="p-5 sm:p-6 flex flex-col justify-between group">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-bold text-ink-soft">Sobra Estimada</p>
              <p className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-ink tabular tracking-tight">
                {BRL.format(saldo > 0 ? saldo : 0)}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-ink-soft shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-ink-soft">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Isento de IRPF
            </span>
            <span className="font-semibold text-hexxa-forest dark:text-hexxa-lime">
              + Lucro Sócios
            </span>
          </div>
        </Card>
      </div>

      {/* ── Linha Central: Evolução do Faturamento + Eficiência Operacional (Estilo Donezo) ── */}
      {temSerie && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2">
            <ChunkyBarChart
              items={chunkyItems}
              title="Evolução do Faturamento"
              subtitle="Histórico semestral com barras espessas hachuradas"
              height={180}
            />
          </div>
          <div className="lg:col-span-1">
            <HalfDonutGauge
              percentage={margem > 0 ? margem : 75}
              title="Eficiência Operacional"
              subtitle="Margem de lucro sobre receita do mês"
              realizadoLabel="Sobra Líquida"
              restanteLabel="Custos / DAS"
              margemLabel="Margem"
              margemValue={pct(margem > 0 ? margem / 100 : 0.748)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

