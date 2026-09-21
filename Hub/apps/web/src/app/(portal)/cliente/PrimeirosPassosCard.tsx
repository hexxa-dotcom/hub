import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getPrimeirosPassos } from '@/lib/server/primeiros-passos';

/**
 * O QUE FAZER AGORA — a primeira coisa que alguém vê ao entrar.
 *
 * ── Por que isto é o card mais importante da tela ──────────────────────
 *
 * Quem acabou de pagar e fez o primeiro login não quer um painel: quer saber
 * se o dinheiro foi bem gasto. Um painel cheio de zeros não responde isso, e
 * um menu com trinta itens responde pior ainda. Três passos com o que cada um
 * destrava respondem.
 *
 * ── Por que ele some sozinho ───────────────────────────────────────────
 *
 * Porque o progresso é medido, não marcado (ver `getPrimeirosPassos`).
 * Terminados os três, o card desaparece e a tela vira o painel de verdade.
 * Um "onboarding concluído ✓" pendurado para sempre é ruído.
 */
export async function PrimeirosPassosCard() {
  let dados;
  try {
    dados = await getPrimeirosPassos(await getTenantContext());
  } catch (err) {
    console.error('[PrimeirosPassosCard] falhou:', err);
    return null;
  }

  if (dados.completo) return null;

  return (
    <section className="rounded-3xl border border-[#DFFFAE]/60 bg-[#EFFFD6]/60 p-5 dark:border-[#2F4A3C] dark:bg-[#1E3328]/40 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-bold text-[#231F20] dark:text-[#F5F6F4]">
          Faltam {dados.total - dados.concluidos} passos para seu Hub funcionar
        </h2>
        <span className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
          {dados.concluidos} de {dados.total}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Leva cinco minutos. Dá para parar no meio e voltar depois — nada se perde.
      </p>

      <ol className="mt-4 space-y-2">
        {dados.passos.map((p) => {
          const feito = p.estado === 'FEITO';
          const linha = (
            <div
              className={`flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ${
                feito ? '' : 'bg-white dark:bg-[#231F20]'
              }`}
            >
              {feito ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-bold ${
                    feito
                      ? 'text-[#6E6A61] line-through dark:text-[#A8A49C]'
                      : 'text-[#231F20] dark:text-[#F5F6F4]'
                  }`}
                >
                  {p.titulo}
                </p>
                {!feito && (
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{p.porque}</p>
                )}
              </div>
              {!feito && (
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              )}
            </div>
          );

          return (
            <li key={p.id}>
              {feito ? linha : <Link href={p.href}>{linha}</Link>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
