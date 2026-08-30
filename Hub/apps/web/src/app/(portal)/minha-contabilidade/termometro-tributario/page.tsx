import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, getCurrentMinimumWage } from '@/lib/server/fiscal';
import { TaxThermometerService, ProlaboreAutopilotService } from '@hexxa/core';
import { BarChart3, TrendingUp, AlertTriangle, Users, Sparkles, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const dynamic = 'force-dynamic';

export default async function TermometroTributarioPage() {
  const ctx = await getTenantContext();
  const [{ rbt12, folha12 }, minimumWage] = await Promise.all([
    getSimplesInputs(ctx),
    getCurrentMinimumWage(),
  ]);
  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });

  // Piloto Automático do Pró-labore
  // `folha12` é uma PROJEÇÃO (folha do mês atual × 12), não um histórico
  // real mês a mês — o sistema ainda não guarda folha paga por competência.
  // O serviço espera especificamente os últimos 11 MESES (o 12º é o
  // pró-labore que ele está calculando agora); escalar por 11/12 alinha as
  // unidades, mas ainda é uma aproximação enquanto não existir um histórico
  // de folha de fato.
  const payrollLast11Months = (folha12 * 11) / 12;
  const autopilot = new ProlaboreAutopilotService().calculateIdealProlabore({
    rbt12,
    payrollLast11Months,
    minimumWage,
  });

  const LIMITE_TETO = 4_800_000;
  const LIMITE_SUBLIMITE = 3_600_000;
  const pctTeto = Math.min((rbt12 / LIMITE_TETO) * 100, 100);
  const isNearSublimite = rbt12 >= LIMITE_SUBLIMITE * 0.8;
  const isOverSublimite = rbt12 >= LIMITE_SUBLIMITE;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <BarChart3 className="h-3.5 w-3.5" />
              Minha Contabilidade
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Bússola Tributária
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Acompanhamento em tempo real da alíquota efetiva do Simples Nacional, sublimite e enquadramento do Fator R.
          </p>
        </div>
      </header>

      {rbt12 === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/15 dark:border-white/15 bg-[#F4EFE4]/40 dark:bg-[#1A201C]/40 p-12 text-center">
          <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhum faturamento registrado nos últimos 12 meses.</p>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Emita notas fiscais ou lance recebíveis para ver a posição tributária aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card Principal: RBT12 */}
            <div className="lg:col-span-2 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">
                  Faturamento Acumulado (RBT12)
                </h2>
                <span className="rounded-full bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 px-3 py-1 text-[11px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">
                  Últimos 12 meses
                </span>
              </div>
              <div className="mb-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="font-serif font-extrabold text-3xl sm:text-4xl text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(rbt12)}</p>
                  <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">receita bruta acumulada</p>
                </div>
              </div>

              <div className="relative pt-6 pb-2">
                <div className="h-4 w-full bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 rounded-full overflow-hidden relative flex">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      pctTeto > 95 ? 'bg-red-500' : pctTeto > 75 ? 'bg-amber-500' : 'bg-[#2F4A3C] dark:bg-[#DFFFAE]'
                    }`}
                    style={{ width: `${pctTeto}%` }}
                  />
                </div>

                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1 h-10 border-l border-dashed border-black/20 dark:border-white/20" style={{ left: `${(LIMITE_SUBLIMITE / LIMITE_TETO) * 100}%` }}>
                    <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C]">Sublimite (R$ 3,6M)</div>
                  </div>
                  <div className="absolute top-1 h-10 border-r border-dashed border-red-500/50" style={{ left: '100%' }}>
                    <div className="absolute -top-5 -translate-x-full whitespace-nowrap text-[10px] font-bold text-red-600 dark:text-red-400 pr-1">Teto (R$ 4,8M)</div>
                  </div>
                </div>
              </div>

              {isOverSublimite ? (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-800 dark:text-red-300">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Atenção: Sublimite Ultrapassado</p>
                    <p className="text-xs mt-0.5">A empresa ultrapassou R$ 3,6 milhões e passará a recolher ICMS/ISS fora do Simples Nacional.</p>
                  </div>
                </div>
              ) : isNearSublimite ? (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Aviso de Proximidade do Sublimite</p>
                    <p className="text-xs mt-0.5">O faturamento está próximo de R$ 3,6M. Margem disponível: {BRL.format(LIMITE_SUBLIMITE - rbt12)}.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#EFFFD6] border border-[#2F4A3C]/10 p-4 text-[#2F4A3C] dark:bg-[#2F4A3C]/30 dark:text-[#DFFFAE]">
                  <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Enquadramento Confortável</p>
                    <p className="text-xs mt-0.5">Você tem margem de {BRL.format(LIMITE_SUBLIMITE - rbt12)} antes de atingir o sublimite estadual/municipal.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Cards Secundários */}
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-3">Carga Tributária Efetiva</h3>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif font-extrabold text-3xl sm:text-4xl text-[#231F20] dark:text-[#FEFDF3]">{rate(simples.effectiveRate)}</span>
                  <span className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">alíquota real</span>
                </div>
                <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nominal da faixa: {rate(simples.nominalRate)}</p>
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                    Enquadramento Atual:
                    <strong className="text-sm text-[#231F20] dark:text-[#FEFDF3] mt-1 block">Anexo {simples.anexo} · Faixa {simples.faixa}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C] mb-3 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Fator R (Folha / Faturamento)
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif font-extrabold text-3xl sm:text-4xl text-[#231F20] dark:text-[#FEFDF3]">{rate(simples.fatorR * 100)}</span>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    simples.fatorRFavorable
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {simples.fatorRFavorable ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {simples.fatorRFavorable ? 'Favorável (≥ 28%) · Anexo III' : 'Abaixo de 28% · Anexo V'}
                  </span>
                </div>
                {!simples.fatorRFavorable && (
                  <Link
                    href="/minha-contabilidade/socios"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]"
                  >
                    Ajustar pró-labore em Sócios <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* Novo Card: Piloto Automático do Fator R */}
              <div className="rounded-3xl border border-[#DFFFAE]/50 bg-[#EFFFD6] p-6 shadow-sm dark:bg-[#1E3328] dark:border-[#2F4A3C]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE] mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Piloto Automático Fator R
                </h3>
                
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1E3328] dark:text-[#DFFFAE]">{BRL.format(autopilot.idealProlabore)}</span>
                </div>
                <p className="mt-1 text-xs text-[#2F4A3C]/80 dark:text-[#A8A49C]">pró-labore ideal p/ mês atual</p>
                
                <div className="mt-3 text-xs font-medium text-[#1E3328] dark:text-[#DFFFAE] leading-relaxed">
                  {autopilot.reasoning}
                </div>
                
                <div className="mt-4 pt-4 border-t border-[#2F4A3C]/10 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">Status da Proteção</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    autopilot.isSafeAnexoIII ? 'bg-[#2F4A3C] text-[#EFFFD6]' : 'bg-red-500 text-white'
                  }`}>
                    {autopilot.isSafeAnexoIII ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {autopilot.isSafeAnexoIII ? 'Protegido (Anexo III)' : 'Risco de Anexo V'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {simples.toNextFaixa !== null ? (
            <div className="flex items-start gap-4 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Projeção de Próxima Faixa</h3>
                <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
                  Faltam <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(simples.toNextFaixa)}</span> de faturamento acumulado para entrar na Faixa{' '}
                  {simples.faixa + 1}, onde a alíquota nominal passa de {rate(simples.nominalRate)} para{' '}
                  <span className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{rate(simples.nextRate ?? 0)}</span>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Última Faixa do Simples Nacional</h3>
                <p className="mt-1 text-xs sm:text-sm text-amber-800 dark:text-amber-300">Você está na faixa máxima do regime simplificado — atenção especial ao teto de R$ 4,8M.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

