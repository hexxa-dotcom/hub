import { createRawClient } from '@/lib/supabase/server';
import { FileText, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function AdminFechamentosPage() {
  const supabase = await createRawClient();

  // Buscar todos os fechamentos cruzados com as empresas
  const { data: closures, error } = await supabase
    .from('monthly_closure')
    .select('*, company:company_id(name)')
    .order('reference_month', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
  }

  // Agrupar por mês
  const byMonth: Record<string, typeof closures> = {};
  if (closures) {
    for (const c of closures) {
      if (c && c.reference_month) {
        if (!byMonth[c.reference_month]) byMonth[c.reference_month] = [];
        byMonth[c.reference_month]!.push(c);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Fechamentos Mensais</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Acompanhe os dados contábeis consolidados dos seus clientes.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar cliente..." 
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(byMonth).map(([monthStr, list]) => {
          const [y, m] = monthStr.split('-');
          const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          
          const totalRev = list?.reduce((acc, c) => acc + Number(c.total_revenue), 0) || 0;

          return (
            <section key={monthStr} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-slate-200">
                  {monthName}
                </h2>
                <div className="text-sm text-slate-500 font-medium">
                  {list?.length} clientes consolidados · Total {BRL.format(totalRev)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-3 font-medium text-slate-500">Cliente</th>
                      <th className="px-5 py-3 font-medium text-slate-500 text-right">Faturamento</th>
                      <th className="px-5 py-3 font-medium text-slate-500 text-right">Despesas</th>
                      <th className="px-5 py-3 font-medium text-slate-500 text-center">Inadimplentes</th>
                      <th className="px-5 py-3 font-medium text-slate-500 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {list?.map(closure => (
                      <tr key={closure.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                          {/* @ts-ignore */}
                          {closure.company?.name || 'Empresa Desconhecida'}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-400">
                          {BRL.format(Number(closure.total_revenue))}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-400">
                          {BRL.format(Number(closure.total_expenses))}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {closure.defaults_count > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-xl text-xs">
                              <AlertCircle className="h-3 w-3" /> {closure.defaults_count}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {closure.status === 'CLOSED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pronto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {closure.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {Object.keys(byMonth).length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-500">
            <FileText className="h-12 w-12 opacity-20" />
            <p>Nenhum fechamento registrado ainda.</p>
            <p className="text-xs">Os fechamentos rodam automaticamente todo dia 1º de cada mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}
