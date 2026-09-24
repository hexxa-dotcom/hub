import { AlertTriangle, CalendarClock, Gauge } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getPrevisaoCaixa, getPosicaoNoTeto } from '@/lib/server/previsao-caixa';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATA = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
const MES = (aaaaMM: string) =>
  new Date(`${aaaaMM}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

/**
 * Os próximos 90 dias, e quando o teto do Simples chega.
 *
 * Duas perguntas que o prestador de serviço só costuma responder tarde: "vou
 * ter dinheiro em novembro?" e "vou estourar o Simples este ano?". As contas
 * estão em `projetarCaixa` e `posicaoNoTeto`, com o porquê de cada escolha.
 *
 * O card mostra uma DATA, não um gráfico. "Dia 12 de novembro você fica
 * negativo" é acionável; uma curva não é.
 */
export async function PrevisaoCaixaCard() {
  let previsao;
  let teto;
  try {
    const ctx = await getTenantContext();
    [previsao, teto] = await Promise.all([getPrevisaoCaixa(ctx), getPosicaoNoTeto(ctx)]);
  } catch (err) {
    console.error('[PrevisaoCaixaCard] falhou:', err);
    return null;
  }

  // Sem saldo conhecido a projeção parte de um número que não existe. O card
  // do caixa livre já explica o que fazer — repetir aqui só duplicaria o aviso.
  if (!previsao.saldoConhecido) return null;

  const avisoDeTeto = teto?.mesDoEstouro ?? null;
  const semMovimento = previsao.dias.length === 0;

  return (
    <section data-card="true" className="rounded-3xl border border-black/5 bg-surface-card p-5 dark:border-white/10 sm:p-6 shadow-(--elev-1)">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1E3328] text-[#DFFFAE]">
          <CalendarClock className="h-3.5 w-3.5" />
        </span>
        <h2 className="rotulo text-[#6E6A61] dark:text-[#A8A49C]">
          Próximos 90 dias
        </h2>
      </div>

      {semMovimento ? (
        <p className="mt-3 text-sm text-[#231F20] dark:text-[#F5F6F4]">
          Nada a pagar nem a receber lançado para os próximos 90 dias. O saldo segue em{' '}
          {BRL.format(previsao.saldoFinal)}.
        </p>
      ) : (
        <>
          <p
            className={`mt-2 font-serif text-2xl font-bold tabular sm:text-3xl ${
              previsao.primeiroDiaNegativo
                ? 'text-red-700 dark:text-red-400'
                : 'text-[#2F4A3C] dark:text-[#DFFFAE]'
            }`}
          >
            {BRL.format(previsao.saldoFinal)}
          </p>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            É onde o caixa chega, contando tudo que já está marcado para entrar e sair.
          </p>

          {previsao.primeiroDiaNegativo ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                O caixa fica negativo em <strong>{DATA(previsao.primeiroDiaNegativo)}</strong>, chegando
                a {BRL.format(previsao.piorDia!.saldo)}. Dá para antecipar um recebimento ou adiar um
                pagamento até lá.
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              O caixa não fica negativo em nenhum dia do período. Menor saldo:{' '}
              {BRL.format(previsao.piorDia!.saldo)} em {DATA(previsao.piorDia!.data)}.
            </p>
          )}

          <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-3 text-xs dark:border-white/10 sm:text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#6E6A61] dark:text-[#A8A49C]">A receber no período</dt>
              <dd className="tabular font-medium text-[#231F20] dark:text-[#F5F6F4]">
                {BRL.format(previsao.totalAReceber)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[#6E6A61] dark:text-[#A8A49C]">A pagar no período</dt>
              <dd className="tabular font-medium text-[#231F20] dark:text-[#F5F6F4]">
                −{BRL.format(previsao.totalAPagar)}
              </dd>
            </div>
          </dl>
        </>
      )}

      {avisoDeTeto && (
        <p className="mt-4 flex items-start gap-1.5 border-t border-black/5 pt-3 text-xs text-amber-700 dark:border-white/10 dark:text-amber-400">
          <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No ritmo atual, o faturamento bate o teto do Simples em{' '}
            <strong>{MES(avisoDeTeto)}</strong> — faltam {BRL.format(Math.max(0, teto!.folga))} dos{' '}
            {BRL.format(teto!.limite)}. Estourar o limite significa mudar de regime no ano seguinte;
            vale conversar com a contabilidade antes.
            {!teto!.apurado && ' O cálculo usa as notas da Hexx, ainda sem apuração do contábil.'}
          </span>
        </p>
      )}
    </section>
  );
}
