import Link from 'next/link';
import { Check } from '@phosphor-icons/react/dist/ssr';
import type { Passo } from '@/lib/server/primeiros-passos';

/**
 * Onde a pessoa está, dos três passos.
 *
 * Existe porque "quantos faltam" é a pergunta que decide se alguém termina ou
 * abandona no meio. Um formulário sem fim faz desistir; três caixinhas, das
 * quais duas já estão marcadas, não.
 *
 * Passo concluído é link: dá para voltar e corrigir. Estado que só avança
 * obriga a pessoa a acertar de primeira, e ninguém acerta de primeira.
 */
export const TITULOS_DOS_PASSOS: Record<Passo['id'], string> = {
  empresa: 'Sua empresa',
  fiscal: 'Nota fiscal',
  'ponto-de-partida': 'Faturamento',
};

export function PassosDoOnboarding({
  passos,
  atual,
}: {
  passos: Pick<Passo, 'id' | 'href' | 'estado'>[];
  atual: Passo['id'];
}) {
  return (
    <ol className="mb-6 flex items-center justify-center gap-2 text-xs">
      {passos.map((p, i) => {
        const aqui = p.id === atual;
        const feito = p.estado === 'FEITO' && !aqui;
        const conteudo = (
          <span className={`flex items-center gap-1.5 ${aqui ? 'font-semibold text-black' : 'text-black/50'}`}>
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                aqui ? 'bg-black text-white' : feito ? 'border border-black text-black' : 'border border-black/20'
              }`}
            >
              {feito ? <Check className="h-3 w-3" weight="bold" /> : i + 1}
            </span>
            {TITULOS_DOS_PASSOS[p.id]}
          </span>
        );
        return (
          <li key={p.id} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-black/15" />}
            {feito ? <Link href={p.href as never}>{conteudo}</Link> : conteudo}
          </li>
        );
      })}
    </ol>
  );
}
