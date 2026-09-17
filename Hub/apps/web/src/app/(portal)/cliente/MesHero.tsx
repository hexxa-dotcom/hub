import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { FaturamentoChart } from './FaturamentoChart';

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

/** "set", "out" — rótulo curto para o eixo. */
function rotuloMes(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
}

/**
 * Card principal da tela, acima do seletor de vista.
 *
 * Fica no nível da página, e não dentro de uma das vistas, porque o total do
 * mês é o contexto das duas: trocar entre Resumo e Detalhes muda o
 * detalhamento, não o mês nem o quanto entrou nele.
 */
export async function MesHero() {
  const meses = Array.from({ length: 6 }, (_, i) => mesRef(i - 5)); // 5 anteriores + atual
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

  const grafico = meses.map((m, i) => ({ mes: rotuloMes(m), receita: serie[i] ?? 0 }));

  const faturamento = serie[5] ?? 0;
  const faturamentoAnt = serie[4] ?? 0;
  const saldo = faturamento - despesas;

  const variacao = (atualVal: number, antVal: number) =>
    antVal > 0 ? (atualVal - antVal) / antVal : null;

  const tendencia = variacao(faturamento, faturamentoAnt);
  const temSerie = serie.some((v) => v > 0);

  return (
    <Card level={3} tone="deep" className="flex flex-col justify-between gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
        <div className="min-w-0">
          <CardHeader label="Faturamento do mês" />
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <Metric value={BRL.format(faturamento)} size="hero" />
            {tendencia !== null && tendencia !== 0 && (
              <Delta valor={tendencia} sufixo="vs. mês anterior" />
            )}
          </div>
        </div>

        {/* A curva responde "desde quando" — o que o número sozinho não diz.
            Ocupa metade do card porque ali havia só espaço vazio. */}
        {temSerie && (
          <div className="min-w-0 lg:border-l lg:border-ink/10 lg:pl-8">
            {/* Divisor fixo: separa os dois ambientes do card. Antes só havia a
                linha do cursor do gráfico, que aparecia no hover e sumia — o
                gráfico ficava solto no espaço. */}
            <p className="text-caption uppercase text-ink-soft">Últimos 6 meses</p>
            <div className="mt-2 h-32">
              <FaturamentoChart data={grafico} />
            </div>
          </div>
        )}
      </div>

      <dl className="grid gap-6 border-t border-black/5 pt-6 sm:grid-cols-3 dark:border-white/5">
        <Linha
          rotulo="Despesas do mês"
          valor={BRL.format(despesas)}
          delta={variacao(despesas, despesasAnt)}
          /* Em despesa, subir é ruim: a cor do delta precisa inverter. */
          inverterCor
        />
        <Linha rotulo="Imposto provisionado" valor={BRL.format(provisao)} delta={null} />
        <Linha rotulo="Saldo projetado" valor={BRL.format(saldo)} delta={variacao(saldo, saldoAnt)} destaque />
      </dl>
    </Card>
  );
}

function Delta({
  valor,
  sufixo,
  inverterCor = false,
}: {
  valor: number;
  sufixo?: string;
  inverterCor?: boolean;
}) {
  const subiu = valor >= 0;
  const bom = inverterCor ? !subiu : subiu;
  return (
    <span
      className={`text-footnote font-semibold ${bom ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-expense'}`}
    >
      {subiu ? '↑' : '↓'} {pct(Math.abs(valor))}
      {sufixo ? ` ${sufixo}` : ''}
    </span>
  );
}

function Linha({
  rotulo,
  valor,
  delta,
  destaque = false,
  inverterCor = false,
}: {
  rotulo: string;
  valor: string;
  delta: number | null;
  destaque?: boolean;
  inverterCor?: boolean;
}) {
  return (
    <div>
      <dt className="text-caption uppercase text-ink-soft">{rotulo}</dt>
      <dd
        className={`text-title2 font-serif tabular mt-1.5 ${
          destaque ? 'text-hexxa-green dark:text-hexxa-lime' : 'text-ink'
        }`}
      >
        {valor}
      </dd>
      {/* Reserva a altura mesmo sem delta, para as três colunas não
          desalinharem quando uma delas não tem comparação. */}
      <div className="mt-1 h-4">
        {delta !== null && delta !== 0 && <Delta valor={delta} inverterCor={inverterCor} />}
      </div>
    </div>
  );
}
