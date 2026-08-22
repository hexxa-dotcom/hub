import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { TaxThermometerService } from '@hexxa/core';
import { WarningCircle, TrendUp, ChartBar, Users } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const dynamic = 'force-dynamic';

export default async function TermometroTributarioPage() {
  const ctx = await getTenantContext();
  const { rbt12, folha12 } = await getSimplesInputs(ctx);
  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });

  const LIMITE_TETO = 4_800_000;
  const LIMITE_SUBLIMITE = 3_600_000;
  const pctTeto = Math.min((rbt12 / LIMITE_TETO) * 100, 100);
  const isNearSublimite = rbt12 >= LIMITE_SUBLIMITE * 0.8;
  const isOverSublimite = rbt12 >= LIMITE_SUBLIMITE;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <ChartBar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Quanto Pago de Imposto (Fator R)</h1>
          <p className="text-sm text-ink-soft">
            Calculado ao vivo a partir do seu faturamento e folha reais — não depende de envio da contabilidade.
          </p>
        </div>
      </div>

      {rbt12 === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-ink-soft font-medium">Nenhum faturamento registrado nos últimos 12 meses ainda.</p>
          <p className="text-ink-soft/70 text-sm mt-1">Emita notas fiscais ou lance recebíveis para ver a posição tributária aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card Principal: RBT12 */}
            <div className="lg:col-span-2 rounded-2xl border border-line bg-surface-card p-6 shadow-sm relative overflow-hidden">
              <h2 className="text-sm font-semibold text-ink mb-6 flex items-center justify-between">
                Faturamento Acumulado (RBT12)
                <span className="text-xs font-normal px-2 py-1 bg-surface-card border border-line dark:bg-white/5 rounded text-ink-soft">Últimos 12 meses, hoje</span>
              </h2>
              <div className="mb-6">
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-bold text-ink">{BRL.format(rbt12)}</p>
                  <p className="text-sm text-ink-soft mt-1">Faturado nos últimos 12 meses</p>
                </div>
              </div>

              <div className="relative pt-6 pb-2">
                <div className="h-4 w-full bg-surface-card border border-line rounded-full dark:bg-white/5 overflow-hidden relative flex">
                  <div
                    className={`h-full transition-all duration-1000 ${pctTeto > 95 ? 'bg-critical' : pctTeto > 75 ? 'bg-warn' : 'bg-brand-500'}`}
                    style={{ width: `${pctTeto}%` }}
                  />
                </div>

                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1 h-10 border-l border-dashed border-ink-soft/40" style={{ left: `${(LIMITE_SUBLIMITE / LIMITE_TETO) * 100}%` }}>
                    <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-ink-soft">Sublimite (R$ 3,6M)</div>
                  </div>
                  <div className="absolute top-1 h-10 border-r border-dashed border-critical/50" style={{ left: '100%' }}>
                    <div className="absolute -top-5 -translate-x-full whitespace-nowrap text-[10px] font-semibold text-critical pr-1">Teto (R$ 4,8M)</div>
                  </div>
                </div>
              </div>

              {isOverSublimite ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl bg-critical/10 p-4 text-critical">
                  <WarningCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Atenção: Sublimite Ultrapassado</p>
                    <p className="text-xs mt-1">A empresa ultrapassou R$ 3,6 milhões e passará a recolher ICMS/ISS fora do Simples Nacional.</p>
                  </div>
                </div>
              ) : isNearSublimite ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl bg-warn/10 p-4 text-warn">
                  <WarningCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Aviso de Proximidade</p>
                    <p className="text-xs mt-1">O faturamento está próximo do sublimite de R$ 3,6M. Faltam apenas {BRL.format(LIMITE_SUBLIMITE - rbt12)}.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-start gap-3 rounded-xl bg-brand-500/10 p-4 text-brand-600 dark:text-brand-400">
                  <TrendUp className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Situação Confortável</p>
                    <p className="text-xs mt-1">Você tem margem de {BRL.format(LIMITE_SUBLIMITE - rbt12)} antes de atingir o sublimite estadual/municipal.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Cards Secundários */}
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-line bg-surface-card p-6 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-4">Carga Tributária Atual</h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-ink">{rate(simples.effectiveRate)}</span>
                  <span className="text-sm text-ink-soft mb-1">alíquota efetiva</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">Nominal da faixa: {rate(simples.nominalRate)}</p>
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-sm text-ink-soft">
                    Enquadramento atual:
                    <br />
                    <strong className="text-ink mt-1 block">Anexo {simples.anexo} · Faixa {simples.faixa}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface-card p-6 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-4 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Fator R
                </h3>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-ink">{rate(simples.fatorR * 100)}</span>
                </div>
                <p className={`mt-2 text-xs font-medium ${simples.fatorRFavorable ? 'text-ok' : 'text-warn'}`}>
                  {simples.fatorRFavorable
                    ? 'Favorável (≥ 28%) — mantém o Anexo III'
                    : 'Abaixo de 28% — empresa cai no Anexo V (alíquota maior)'}
                </p>
                {!simples.fatorRFavorable && (
                  <Link href="/minha-contabilidade/socios" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                    Ver quanto de pró-labore ajustar em Sócios →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {simples.toNextFaixa !== null ? (
            <p className="text-sm text-ink-soft">
              Faltam <span className="font-semibold text-ink">{BRL.format(simples.toNextFaixa)}</span> de faturamento (12 meses) para a Faixa{' '}
              {simples.faixa + 1} (alíquota nominal sobe para {rate(simples.nextRate ?? 0)}).
            </p>
          ) : (
            <p className="text-sm text-warn">Você está na última faixa do Simples Nacional — atenção ao teto de R$ 4,8M.</p>
          )}
        </div>
      )}
    </div>
  );
}
