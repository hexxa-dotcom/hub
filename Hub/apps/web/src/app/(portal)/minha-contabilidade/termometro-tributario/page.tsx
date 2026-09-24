import Link from 'next/link';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, getCurrentMinimumWage, enquadramentoApurado, fatorRSeAplica, posicaoSimples } from '@/lib/server/fiscal';
import { faturamentoMensal, regimeDaEmpresa, ultimaGuiaDeImposto } from '@/lib/server/bussola';
import { ProlaboreAutopilotService } from '@hexxa/core';
import { estimativaPresumido } from '@hexxa/core/presumido';
import { SectionHero } from '@/components/ui/SectionHero';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { GraficoFaturamento } from './GraficoFaturamento';

/**
 * BÚSSOLA TRIBUTÁRIA — quanto de imposto o faturamento está gerando, e para
 * onde ele vai.
 *
 * A pergunta do empresário é "quanto vou pagar?". Por isso o primeiro número
 * é o imposto estimado do mês (faturamento do mês × alíquota efetiva), com o
 * caminho para a guia. Depois, o faturamento mês a mês, a posição na faixa
 * — onde está e quanto falta para a próxima — e, só para quem depende dele,
 * o Fator R.
 *
 * O conteúdo segue o regime: Simples (faixa, Fator R), Lucro Presumido
 * (tributos federais sobre a receita) e Lucro Real (acompanhado pelo contador).
 */

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SUBLIMITE = 3_600_000;
const TETO = 4_800_000;

export default async function BussolaTributariaPage() {
  const ctx = await getTenantContext();
  const [{ rbt12, folha12 }, minimumWage, apurado, meses, regime, guia] = await Promise.all([
    getSimplesInputs(ctx),
    getCurrentMinimumWage(),
    enquadramentoApurado(ctx),
    faturamentoMensal(ctx),
    regimeDaEmpresa(ctx),
    ultimaGuiaDeImposto(ctx),
  ]);
  const mesAtual = meses[meses.length - 1]!;
  const nomeDoMes = MESES[Number(mesAtual.mes.slice(5)) - 1]!;
  // Notas que passaram pela Hexx. Empresa cuja nota sai pela prefeitura e vai
  // direto para a contabilidade não tem nenhuma — mas tem a apuração (RBT12,
  // alíquota) e as guias, e a Bússola trabalha com elas.
  const temNotas = meses.some((m) => m.valor > 0);
  const semMovimento = !temNotas && rbt12 === 0 && !guia;
  const guiaTexto = guia
    ? `${guia.nome} de ${MESES[Number(guia.mes.slice(5)) - 1]} · vence ${guia.vencimento.split('-').reverse().join('/')}${guia.paga ? ' · paga' : ''}`
    : null;
  const semNotasAviso = (
    <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-6 text-sm text-ink-soft dark:border-white/10">
      O faturamento mês a mês aparece quando as notas passarem pela Hexx — emitidas aqui ou trazidas do Emissor Nacional com o
      certificado digital. Por enquanto, a Bússola usa a apuração da contabilidade.
    </p>
  );

  const hero = (subtitulo: string) => (
    <SectionHero
      title="Bússola Tributária"
      subtitulo={subtitulo}
      infoTitle="Sobre a Bússola Tributária"
      infoDescription="Quanto de imposto o seu faturamento está gerando, em que faixa a empresa está e quanto falta para a próxima. O faturamento considerado é só o das notas fiscais; a alíquota é a apurada pela contabilidade quando houver, ou uma estimativa."
    />
  );

  if (semMovimento) {
    return (
      <div className="w-full space-y-16 pb-20">
        {hero('Sem notas fiscais nos últimos 12 meses')}
        <div className="rounded-[28px] border border-dashed border-black/10 px-6 py-14 text-center dark:border-white/10">
          <p className="text-sm text-ink">Nenhuma nota fiscal nos últimos 12 meses.</p>
          <p className="mt-1 text-xs text-ink-soft">Assim que houver notas emitidas, a Bússola mostra o imposto do mês e a sua faixa.</p>
          <Link href={'/meu-negocio/notas' as never} className="mt-3 inline-block text-sm font-semibold text-ink underline-offset-4 hover:underline">
            Ir para Notas
          </Link>
        </div>
      </div>
    );
  }

  // ── LUCRO PRESUMIDO ───────────────────────────────────────────────────
  if (regime === 'LUCRO_PRESUMIDO') {
    const e = estimativaPresumido(mesAtual.valor);
    const ultimo = meses[meses.length - 2]!;
    const eUltimo = estimativaPresumido(ultimo.valor);
    return (
      <div className="w-full space-y-16 pb-20">
        {hero('Lucro Presumido · serviços')}
        <GradeDeResumo colunas={3}>
          <CardResumo
            destaque
            rotulo={`Tributos estimados em ${nomeDoMes}`}
            valor={BRL.format(e.total)}
            nota={`${pct(e.aliquotaEfetiva)} sobre ${BRL0.format(mesAtual.valor)} faturados até agora · mais o ISS do município`}
            href="/minha-contabilidade/guias"
          />
          <CardResumo
            rotulo={`Mês passado (${MESES[Number(ultimo.mes.slice(5)) - 1]})`}
            valor={BRL.format(eUltimo.total)}
            nota={`sobre ${BRL0.format(ultimo.valor)} faturados`}
          />
          <CardResumo rotulo="Faturamento em 12 meses" valor={BRL0.format(meses.filter((m) => !m.atual).reduce((s, m) => s + m.valor, 0))} nota="Só notas fiscais" />
        </GradeDeResumo>
        {temNotas ? <GraficoFaturamento meses={meses} /> : semNotasAviso}
        <section className="space-y-4">
          <p className="rotulo text-ink-soft">Como o imposto de {nomeDoMes} se forma</p>
          <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
            {[
              ['PIS', '0,65% da receita', e.pis],
              ['COFINS', '3% da receita', e.cofins],
              ['IRPJ', '15% sobre a base presumida de 32%', e.irpj],
              ...(e.adicionalIrpj > 0 ? [['Adicional do IRPJ', '10% sobre a base acima de R$ 20 mil no mês', e.adicionalIrpj] as const] : []),
              ['CSLL', '9% sobre a base presumida de 32%', e.csll],
            ].map(([nome, regra, valor]) => (
              <li key={nome as string} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink">{nome}</p>
                  <p className="text-xs text-ink-soft">{regra}</p>
                </div>
                <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(valor as number)}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">IRPJ e CSLL são pagos por trimestre; aqui aparecem mês a mês para você saber quanto cada mês gera.</p>
        </section>
      </div>
    );
  }

  // ── LUCRO REAL ────────────────────────────────────────────────────────
  if (regime === 'LUCRO_REAL') {
    return (
      <div className="w-full space-y-16 pb-20">
        {hero('Lucro Real')}
        <GradeDeResumo colunas={2}>
          <CardResumo destaque rotulo={`Faturamento em ${nomeDoMes}`} valor={BRL0.format(mesAtual.valor)} nota="até agora, só notas fiscais" />
          <CardResumo rotulo="Faturamento em 12 meses" valor={BRL0.format(meses.filter((m) => !m.atual).reduce((s, m) => s + m.valor, 0))} />
        </GradeDeResumo>
        {temNotas ? <GraficoFaturamento meses={meses} /> : semNotasAviso}
        <p className="text-sm text-ink-soft">No Lucro Real o imposto depende do lucro apurado no balanço — a contabilidade calcula e envia as guias pela Central.</p>
      </div>
    );
  }

  // ── SIMPLES NACIONAL ──────────────────────────────────────────────────
  const simples = await posicaoSimples(ctx, { rbt12, folha12 });
  // Sem faturamento nos 12 meses fechados (empresa nova), a efetiva calculada
  // dá zero; quem começa paga a alíquota da faixa 1 do anexo.
  const aliquota = apurado ? apurado.aliquotaEfetiva : rbt12 > 0 ? simples.effectiveRate : simples.nominalRate;
  const impostoDoMes = (mesAtual.valor * aliquota) / 100;
  const mesApurado = apurado ? apurado.mes.split('-').reverse().join('/') : null;

  const regraFatorR = fatorRSeAplica(apurado, simples.fatorR);
  const favoravel = apurado && ['III', 'V'].includes(apurado.anexo) ? apurado.anexo === 'III' : simples.fatorRFavorable;
  const autopilot = new ProlaboreAutopilotService().calculateIdealProlabore({
    rbt12,
    payrollLast11Months: (folha12 * 11) / 12,
    minimumWage,
  });

  // A régua da faixa: onde o faturamento dos 12 meses está entre o começo e
  // o fim da faixa atual.
  const naFaixa = simples.faixaMax > simples.faixaMin ? Math.min(100, Math.max(0, ((rbt12 - simples.faixaMin) / (simples.faixaMax - simples.faixaMin)) * 100)) : 0;
  const anexo = apurado?.anexo || simples.anexo;

  return (
    <div className="w-full space-y-16 pb-20">
      {hero(`Simples Nacional · Anexo ${anexo} · Faixa ${simples.faixa}`)}

      <GradeDeResumo colunas={3}>
        {temNotas || !guia ? (
          <CardResumo
            destaque
            rotulo={`Imposto estimado de ${nomeDoMes}`}
            valor={BRL.format(impostoDoMes)}
            nota={`${pct(aliquota)} sobre ${BRL0.format(mesAtual.valor)} faturados até agora${guiaTexto ? ` · última guia: ${BRL.format(guia!.valor)}` : ''}`}
            href="/minha-contabilidade/guias"
          />
        ) : (
          <CardResumo destaque rotulo="Última guia do imposto" valor={BRL.format(guia.valor)} nota={guiaTexto!} href="/minha-contabilidade/guias" />
        )}
        <CardResumo
          rotulo="Alíquota efetiva"
          valor={pct(aliquota)}
          nota={apurado ? `apurada pela contabilidade em ${mesApurado}` : `estimativa · nominal da faixa ${pct(simples.nominalRate)}`}
        />
        <CardResumo rotulo="Faturamento em 12 meses" valor={BRL0.format(rbt12)} nota="É ele que define a sua faixa (RBT12)" />
      </GradeDeResumo>

      {temNotas ? <GraficoFaturamento meses={meses} /> : semNotasAviso}

      {/* A faixa */}
      <section className="space-y-4">
        <p className="rotulo text-ink-soft">Sua faixa</p>
        <div className="rounded-[28px] border border-black/5 p-6 sm:p-8 dark:border-white/10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-lg font-light uppercase tracking-[0.05em] text-ink">
              Faixa {simples.faixa} do Anexo {anexo}
            </p>
            <p className="text-xs text-ink-soft">
              de {BRL0.format(simples.faixaMin)} a {BRL0.format(simples.faixaMax)} em 12 meses
            </p>
          </div>
          <div className="relative mt-6 h-2 rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-hexxa-forest dark:bg-hexxa-lime" style={{ width: `${naFaixa}%` }} />
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-hexxa-forest shadow dark:border-[#151916] dark:bg-hexxa-lime"
              style={{ left: `${naFaixa}%` }}
            />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            {simples.toNextFaixa !== null && simples.projecaoConfiavel ? (
              <>
                Faltam <strong className="font-serif tabular text-ink">{BRL0.format(simples.toNextFaixa)}</strong> de faturamento em 12 meses para a
                faixa {simples.faixa + 1}, onde a alíquota nominal passa de {pct(simples.nominalRate)} para{' '}
                <strong className="font-serif tabular text-ink">{pct(simples.nextRate ?? 0)}</strong>. A alíquota efetiva sobe aos poucos, não de uma vez.
              </>
            ) : simples.toNextFaixa === null ? (
              <>Última faixa do Simples. Acima de {BRL0.format(TETO)} em 12 meses a empresa sai do regime.</>
            ) : (
              <>A posição na faixa segue a apuração da contabilidade.</>
            )}
          </p>
          {rbt12 >= SUBLIMITE * 0.8 && (
            <p className={`mt-3 text-sm font-semibold ${rbt12 >= SUBLIMITE ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {rbt12 >= SUBLIMITE
                ? `Acima do sublimite de ${BRL0.format(SUBLIMITE)}: o ISS passa a ser pago fora do Simples. Fale com a contabilidade.`
                : `A ${BRL0.format(SUBLIMITE - rbt12)} do sublimite de ${BRL0.format(SUBLIMITE)}, a partir do qual o ISS sai do Simples.`}
            </p>
          )}
        </div>
      </section>

      {/* Fator R — só para quem depende dele */}
      <section className="space-y-4">
        <p className="rotulo text-ink-soft">Fator R</p>
        {regraFatorR.aplica ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-black/5 p-6 dark:border-white/10">
              <p className="font-serif text-3xl font-bold tabular text-ink">
                {rbt12 > 0 || apurado?.fatorR != null ? pct((apurado?.fatorR ?? simples.fatorR) * 100) : 'Sem faturamento ainda'}
              </p>
              <p className="mt-1 text-xs text-ink-soft">folha e pró-labore ÷ faturamento em 12 meses{apurado?.fatorR != null ? ' · oficial' : ' · estimativa'}</p>
              <p className={`mt-4 text-sm font-semibold ${favoravel ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {favoravel ? 'Acima de 28%: a empresa fica no Anexo III.' : 'Abaixo de 28%: a empresa cai no Anexo V, mais caro.'}
              </p>
              {!favoravel && (
                <Link href="/minha-contabilidade/socios" className="mt-2 inline-block text-xs font-semibold text-ink underline-offset-4 hover:underline">
                  Ajustar o pró-labore em Sócios
                </Link>
              )}
            </div>
            <div className="rounded-[28px] bg-[#0C110E] p-6 text-white">
              <p className="rotulo text-white/60">Pró-labore para ficar no Anexo III</p>
              <p className="mt-2 font-serif text-3xl font-bold tabular text-[#D4FF00]">{BRL.format(autopilot.idealProlabore)}</p>
              <p className="mt-3 text-xs leading-relaxed text-white/70">{autopilot.reasoning}</p>
              <p className={`mt-4 text-xs font-semibold ${autopilot.isSafeAnexoIII ? 'text-[#D4FF00]' : 'text-rose-400'}`}>
                {autopilot.isSafeAnexoIII ? 'Protegido no Anexo III' : 'Risco de cair no Anexo V'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            {regraFatorR.fora === 'ESTIMADO'
              ? 'A contabilidade apurou a empresa no Anexo III, e pela folha que a Hexx enxerga o Fator R ficaria abaixo de 28% — o que só acontece se a sua atividade não depender dele. Antes de mexer no pró-labore, fale com o seu contador.'
              : `Não se aplica à sua atividade: a empresa está no Anexo ${anexo} pela própria atividade, e mudar o pró-labore não muda o imposto.`}
          </p>
        )}
      </section>
    </div>
  );
}
