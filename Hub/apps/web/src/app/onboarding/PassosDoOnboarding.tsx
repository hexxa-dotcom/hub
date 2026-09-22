import Link from 'next/link';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import type { Passo } from '@/lib/server/primeiros-passos';

/**
 * Onde a pessoa está, dos três passos.
 *
 * Existe porque "quantos faltam" é a pergunta que decide se alguém termina ou
 * abandona no meio. Um formulário sem fim faz desistir; três caixinhas, das
 * quais duas já estão verdes, não.
 *
 * Passo concluído é link: dá para voltar e corrigir. Estado que só avança
 * obriga a pessoa a acertar de primeira, e ninguém acerta de primeira.
 */
export function PassosDoOnboarding({ passos, atual }: { passos: Passo[]; atual: Passo['id'] }) {
  return (
    <ol className="flex items-stretch gap-2">
      {passos.map((p, i) => {
        const aqui = p.id === atual;
        const feito = p.estado === 'FEITO';
        const conteudo = (
          <div
            className={`flex h-full flex-col justify-between rounded-2xl border px-3 py-2.5 transition-colors ${
              aqui
                ? 'border-[#2F4A3C] bg-[#EFFFD6] dark:border-[#DFFFAE] dark:bg-[#2F4A3C]/30'
                : 'border-black/5 bg-white dark:border-white/10 dark:bg-[#231F20]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {feito ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" weight="fill" />
              ) : (
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    aqui
                      ? 'bg-[#2F4A3C] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]'
                      : 'bg-black/10 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <span className="text-xs font-bold text-[#231F20] dark:text-[#F5F6F4]">{p.titulo}</span>
            </div>
          </div>
        );

        return (
          <li key={p.id} className="flex-1">
            {feito && !aqui ? (
              <Link href={p.href as never} className="block h-full">
                {conteudo}
              </Link>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
    </ol>
  );
}
