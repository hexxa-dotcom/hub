'use client';

import { useState, useTransition } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { autorizarEnvioAction } from './actions';

/**
 * Meses liberados que ainda não podem sair para o OneFlow.
 *
 * Só aparece para empresas com `envioAutomaticoAoLiberar` desligado — o
 * padrão. Liberar diz que o mês está certo; autorizar diz que ele pode ir
 * para os livros oficiais, de onde só sai por exclusão manual. São dois atos
 * porque o segundo não tem volta.
 *
 * A lista vem do servidor a cada revalidação, e o estado local guarda só o
 * que acabou de ser autorizado: guardar a lista inteira aqui a deixaria
 * desatualizada quando um mês é liberado na fila de cima.
 */
export function AguardandoEnvio({
  itens,
}: {
  itens: { companyId: string; empresa: string; mes: string }[];
}) {
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  if (!itens.length) return null;

  function autorizar(companyId: string, mes: string) {
    const chave = `${companyId}:${mes}`;
    setOcupado(chave);
    setErro(null);
    iniciar(async () => {
      const r = await autorizarEnvioAction(companyId, mes);
      setOcupado(null);
      if (r.ok) setFeitos((f) => new Set(f).add(chave));
      else setErro(r.message);
    });
  }

  const mesLegivel = (iso: string) => {
    const [a, m] = iso.split('-');
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${nomes[Number(m) - 1]}/${a}`;
  };

  return (
    <section className="rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1A1A18]">
      <div className="border-b border-black/5 px-5 py-4 dark:border-white/10">
        <h2 className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
          Liberados, esperando envio ao OneFlow
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          Autorizar manda o mês para a contabilidade oficial na próxima execução do envio.
          Lá, lançamento só sai por exclusão manual — por isso este é um clique separado.
        </p>
      </div>

      {erro && (
        <p className="border-b border-black/5 bg-red-500/10 px-5 py-2.5 text-xs text-red-700 dark:border-white/10 dark:text-red-400">
          {erro}
        </p>
      )}

      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {itens.map((i) => {
          const chave = `${i.companyId}:${i.mes}`;
          const feito = feitos.has(chave);
          return (
            <li key={chave} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{i.empresa}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{mesLegivel(i.mes)}</p>
              </div>
              {feito ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Autorizado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => autorizar(i.companyId, i.mes)}
                  disabled={ocupado !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
                >
                  {ocupado === chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Autorizar envio
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
