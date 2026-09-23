'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type ClosureRow = {
  id: string;
  companyId: string;
  companyName: string;
  totalRevenue: string;
  totalExpenses: string;
  defaultsCount: number;
  stage: string;
};

export function FechamentosList({ byMonth }: { byMonth: [string, ClosureRow[]][] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byMonth;
    return byMonth
      .map(([month, list]) => [month, list.filter((c) => c.companyName.toLowerCase().includes(q))] as [string, ClosureRow[]])
      .filter(([, list]) => list.length > 0);
  }, [byMonth, query]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">Fechamentos Mensais</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Acompanhe os dados contábeis consolidados dos seus clientes.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full rounded-full border border-black/10 dark:border-white/10 bg-[#F5F6F4] dark:bg-[#121614] py-2 pl-10 pr-4 text-xs sm:text-sm text-[#231F20] dark:text-[#F5F6F4] outline-none focus:border-[#2F4A3C] shadow-xs"
          />
        </div>
      </div>

      <div className="space-y-8">
        {filtered.map(([monthStr, list]) => {
          const [y, m] = monthStr.split('-');
          const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          const totalRev = list.reduce((acc, c) => acc + Number(c.totalRevenue), 0);

          return (
            <section key={monthStr} className="space-y-4">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
                <h2 className="font-serif font-bold text-lg inline-block first-letter:uppercase text-[#231F20] dark:text-[#F5F6F4]">{monthName}</h2>
                <div className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] font-bold">
                  {list.length} cliente{list.length !== 1 ? 's' : ''} consolidado{list.length !== 1 ? 's' : ''} · Total <span className="text-[#2F4A3C] dark:text-[#DFFFAE]">{BRL.format(totalRev)}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 dark:border-white/10 surface-panel shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10">
                    <tr>
                      <th className="px-5 py-3.5 font-bold text-[#6E6A61] dark:text-[#A8A49C]">Cliente</th>
                      <th className="px-5 py-3.5 font-bold text-[#6E6A61] dark:text-[#A8A49C] text-right">Faturamento</th>
                      <th className="px-5 py-3.5 font-bold text-[#6E6A61] dark:text-[#A8A49C] text-right">Despesas</th>
                      <th className="px-5 py-3.5 font-bold text-[#6E6A61] dark:text-[#A8A49C] text-center">Inadimplentes</th>
                      <th className="px-5 py-3.5 font-bold text-[#6E6A61] dark:text-[#A8A49C] text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/10 bg-[#F5F6F4] dark:bg-[#121614]">
                    {list.map((closure) => (
                      <tr key={closure.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-4 font-bold text-[#231F20] dark:text-[#F5F6F4]">
                          <Link href={`/contador/clientes/${closure.companyId}`} className="hover:text-[#2F4A3C] hover:underline dark:hover:text-[#DFFFAE]">
                            {closure.companyName || 'Empresa desconhecida'}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(Number(closure.totalRevenue))}</td>
                        <td className="px-5 py-4 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(Number(closure.totalExpenses))}</td>
                        <td className="px-5 py-4 text-center">
                          {closure.defaultsCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> {closure.defaultsCount}
                            </span>
                          ) : (
                            <span className="text-[#6E6A61] dark:text-[#A8A49C]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <EstagioBadge stage={closure.stage} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && byMonth.length > 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <Search className="h-12 w-12 opacity-20" />
            <p className="text-xs sm:text-sm">Nenhum cliente encontrado para &ldquo;{query}&rdquo;.</p>
          </div>
        )}

        {byMonth.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center text-[#6E6A61] dark:text-[#A8A49C]">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Nenhum fechamento registrado ainda.</p>
            <p className="text-xs">Os fechamentos rodam automaticamente todo dia 1º de cada mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * O estágio do fechamento, com o nome que ele tem.
 *
 * São quatro fatos diferentes, de donos diferentes: a IA trancou, o contador
 * liberou, foi entregue ao contábil. Mostrar tudo como "pronto" ou "não
 * pronto" apagava justamente a distinção que o fechamento em dois tempos
 * existe para fazer.
 */
function EstagioBadge({ stage }: { stage: string }) {
  const cfg: Record<string, { rotulo: string; cls: string }> = {
    ABERTO:    { rotulo: 'Aberto',    cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' },
    FECHADO:   { rotulo: 'Trancado',  cls: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400' },
    CONFERIDO: { rotulo: 'Liberado',  cls: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
    ENVIADO:   { rotulo: 'Enviado',   cls: 'bg-emerald-600/15 border border-emerald-600/25 text-emerald-800 dark:text-emerald-300' },
    REABERTO:  { rotulo: 'Reaberto',  cls: 'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400' },
  };
  const c = cfg[stage] ?? { rotulo: stage, cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.cls}`}>
      {stage === 'CONFERIDO' || stage === 'ENVIADO' ? <CheckCircle2 className="h-3 w-3" /> : null}
      {c.rotulo}
    </span>
  );
}
