import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, getCurrentMinimumWage, enquadramentoApurado, fatorRSeAplica, posicaoSimples } from '@/lib/server/fiscal';
import { ProlaboreAutopilotService } from '@hexxa/core';
import { BarChart3, TrendingUp, AlertTriangle, Users, Sparkles, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import Link from 'next/link';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const rate = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const dynamic = 'force-dynamic';

export default async function TermometroTributarioPage() {
  const ctx = await getTenantContext();
  const [{ rbt12, folha12 }, minimumWage, apurado] = await Promise.all([
    getSimplesInputs(ctx),
    getCurrentMinimumWage(),
    enquadramentoApurado(ctx),
  ]);
  // Posição com o oficial por cima: faixa, nominal e projeção na tabela do
  // anexo apurado, não no que a folha sugeriria.
  const simples = await posicaoSimples(ctx, { rbt12, folha12 });

  /**
   * O que o contábil apurou manda sobre o que o Hub estima.
   *
   * O cálculo interno decide III ou V pelo Fator R para TODA empresa. Para
   * quem está no Anexo III pela própria atividade, isso virava "Anexo V —
   * aumente o pró-labore": mais INSS, sem benefício nenhum. Onde há apuração
   * importada, o anexo e a alíquota são os dela, e o Fator R só aparece se a
   * atividade se sujeita a ele.
   */
  // A regra de quando o Fator R não se aplica mora em `fatorRSeAplica` —
  // a mesma que a tela de sócios usa.
  const regraFatorR = fatorRSeAplica(apurado, simples.fatorR);
  const fatorRAplica = regraFatorR.aplica;
  const foraOficial = regraFatorR.fora === 'OFICIAL';
  const foraEstimado = regraFatorR.fora === 'ESTIMADO';
  const favoravel = apurado && ['III', 'V'].includes(apurado.anexo)
    ? apurado.anexo === 'III'
    : simples.fatorRFavorable;
  const mesApurado = apurado ? apurado.mes.split('-').reverse().join('/') : null;

  // Piloto Automático do Pró-labore
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
      <SectionHero
        title="Bússola Tributária"
        infoTitle="Sobre a Bússola Tributária"
        infoDescription="Acompanhamento em tempo real da alíquota efetiva do Simples Nacional, sublimite e enquadramento do Fator R."
      />

      {rbt12 === 0 ? (
        <Card level={1} className="border-dashed p-12 text-center card-finish">
          <p className="font-serif font-bold text-base text-ink">Nenhum faturamento registrado nos últimos 12 meses.</p>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">Emita notas fiscais ou lance recebíveis para ver a posição tributária aqui.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card Principal: RBT12 */}
            <Card level={1} className="lg:col-span-2 p-6 sm:p-8 card-finish relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-bold text-lg text-ink">
                  Faturamento Acumulado (RBT12)
                </h2>
                <span className="rounded-full bg-surface-card border border-black/5 dark:border-white/10 px-3 py-1 text-[11px] font-bold text-ink-soft shadow-(--elev-1)">
                  Últimos 12 meses
                </span>
              </div>
              <div className="mb-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="font-serif tabular font-extrabold text-3xl sm:text-4xl text-ink">{BRL.format(rbt12)}</p>
                  <p className="text-xs sm:text-sm text-ink-soft">receita bruta acumulada</p>
                </div>
              </div>

              <div className="relative pt-6 pb-2">
                <div className="h-4 w-full bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/10 rounded-full overflow-hidden relative flex">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      pctTeto > 95 ? 'bg-red-500' : pctTeto > 75 ? 'bg-amber-500' : 'bg-hexxa-forest dark:bg-hexxa-lime'
                    }`}
                    style={{ width: `${pctTeto}%` }}
                  />
                </div>

                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1 h-10 border-l border-dashed border-black/20 dark:border-white/20" style={{ left: `${(LIMITE_SUBLIMITE / LIMITE_TETO) * 100}%` }}>
                    <div className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-ink-soft">Sublimite (R$ 3,6M)</div>
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
                    <p className="text-xs mt-0.5">O faturamento está próximo de R$ 3,6M. Margem disponível: <span className="font-serif tabular font-semibold">{BRL.format(LIMITE_SUBLIMITE - rbt12)}</span>.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-hexxa-forest text-hexxa-lime border border-white/5 p-4 shadow-(--elev-inset)">
                  <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Enquadramento Confortável</p>
                    <p className="text-xs text-hexxa-lime/80 mt-0.5">Você tem margem de <span className="font-serif tabular font-semibold text-hexxa-lime">{BRL.format(LIMITE_SUBLIMITE - rbt12)}</span> antes de atingir o sublimite estadual/municipal.</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Cards Secundários */}
            <div className="flex flex-col gap-6">
              <Card level={1} className="p-6 card-finish">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">Carga Tributária Efetiva</h3>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif tabular font-extrabold text-3xl sm:text-4xl text-ink">{rate(apurado ? apurado.aliquotaEfetiva : simples.effectiveRate)}</span>
                  <span className="text-xs text-ink-soft">{apurado ? `apurada em ${mesApurado}` : 'estimativa'}</span>
                </div>
                {simples.projecaoConfiavel && (
                  <p className="mt-1 text-xs text-ink-soft">Nominal da faixa: <span className="font-serif tabular">{rate(simples.nominalRate)}</span></p>
                )}
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                  <p className="text-xs text-ink-soft">
                    Enquadramento Atual:
                    <strong className="text-sm text-ink mt-1 block">
                      {apurado?.anexo
                        ? <>Anexo {apurado.anexo} <span className="font-normal text-ink-soft">· apurado pelo contábil</span></>
                        : <>Anexo {simples.anexo} · Faixa {simples.faixa} <span className="font-normal text-ink-soft">· estimativa</span></>}
                    </strong>
                  </p>
                </div>
              </Card>

              {fatorRAplica ? (
                <Card level={1} className="p-6 card-finish">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Fator R (Folha / Faturamento)
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif tabular font-extrabold text-3xl sm:text-4xl text-ink">{rate((apurado?.fatorR ?? simples.fatorR) * 100)}</span>
                    <span className="text-xs text-ink-soft">{apurado?.fatorR !== null && apurado?.fatorR !== undefined ? 'oficial' : 'estimativa'}</span>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      favoravel
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    }`}>
                      {favoravel ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {apurado && ['III', 'V'].includes(apurado.anexo)
                        ? `Anexo ${apurado.anexo} · apurado`
                        : favoravel ? 'Favorável (≥ 28%) · Anexo III' : 'Abaixo de 28% · Anexo V'}
                    </span>
                  </div>
                  {!favoravel && (
                    <Link
                      href="/minha-contabilidade/socios"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline"
                    >
                      Ajustar pró-labore em Sócios <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </Card>
              ) : (
                <Card level={1} className="p-6 card-finish">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Fator R
                  </h3>
                  <p className="font-serif font-bold text-base text-ink">
                    {foraOficial ? 'Não se aplica à sua atividade' : 'Seu imposto não depende dele hoje'}
                  </p>
                  {foraEstimado ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                      O contábil apurou sua empresa no Anexo III, e pela folha que o Hub enxerga o
                      Fator R ficaria abaixo de 28% — o que só é possível se a sua atividade não
                      depender dele. Antes de mexer no pró-labore, fale com o seu contador.
                    </p>
                  ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                    O contábil apurou sua empresa no Anexo {apurado?.anexo}
                    {apurado?.fatorR !== null && apurado?.fatorR !== undefined
                      ? `, com Fator R de ${rate(apurado.fatorR * 100)} — abaixo dos 28% que levariam ao Anexo V se a sua atividade dependesse dele`
                      : ''}
                    . O Fator R só decide entre os Anexos III e V para algumas atividades, e a sua não
                    está entre elas: mudar o pró-labore não muda o seu imposto.
                  </p>
                  )}
                </Card>
              )}

              {fatorRAplica && (
              <>
              {/* Piloto Automático do Fator R */}
              <Card level={2} tone="deep" className="p-6 card-finish">
                <h3 className="text-xs font-bold uppercase tracking-wider text-hexxa-lime mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Piloto Automático Fator R
                </h3>
                
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-serif tabular font-extrabold text-2xl sm:text-3xl text-hexxa-sand">{BRL.format(autopilot.idealProlabore)}</span>
                </div>
                <p className="mt-1 text-xs text-hexxa-lime/80">pró-labore ideal p/ mês atual</p>
                
                <div className="mt-3 text-xs font-medium text-hexxa-sand/90 leading-relaxed">
                  {autopilot.reasoning}
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-hexxa-sand/80">Status da Proteção</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    autopilot.isSafeAnexoIII ? 'bg-hexxa-lime text-hexxa-forest shadow-(--elev-1)' : 'bg-red-500 text-white'
                  }`}>
                    {autopilot.isSafeAnexoIII ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {autopilot.isSafeAnexoIII ? 'Protegido (Anexo III)' : 'Risco de Anexo V'}
                  </span>
                </div>
              </Card>
              </>
              )}
            </div>
          </div>

          {!simples.projecaoConfiavel ? null : simples.toNextFaixa !== null ? (
            <Card level={1} className="flex items-start gap-4 p-6 card-finish">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-ink">Projeção de Próxima Faixa</h3>
                <p className="mt-1 text-xs sm:text-sm text-ink-soft">
                  Faltam <span className="font-serif tabular font-bold text-ink">{BRL.format(simples.toNextFaixa)}</span> de faturamento acumulado para entrar na Faixa{' '}
                  {simples.faixa + 1}, onde a alíquota nominal passa de {rate(simples.nominalRate)} para{' '}
                  <span className="font-serif tabular font-bold text-ink">{rate(simples.nextRate ?? 0)}</span>.
                </p>
              </div>
            </Card>
          ) : (
            <Card level={1} className="flex items-start gap-4 border-amber-500/20 bg-amber-500/5 p-6 card-finish">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-ink">Última Faixa do Simples Nacional</h3>
                <p className="mt-1 text-xs sm:text-sm text-amber-800 dark:text-amber-300">Você está na faixa máxima do regime simplificado — atenção especial ao teto de R$ 4,8M.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

