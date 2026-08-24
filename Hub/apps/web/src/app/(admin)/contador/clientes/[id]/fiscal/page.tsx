export const dynamic = 'force-dynamic';
import { taxHistory, getDb, eq, desc } from '@hexxa/db';
import Link from 'next/link';
import {  ArrowLeft, CloudArrowUp, ChartBar, Calendar, ArrowsClockwise  } from '@phosphor-icons/react/dist/ssr';
import { UploadPGDASForm } from './UploadPGDASForm';
import { OneflowSetupForm } from './OneflowSetupForm';
import { getOneflowCredential } from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function AdminFiscalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Buscar histórico de PGDAS
  const history = await db.select()
    .from(taxHistory)
    .where(eq(taxHistory.companyId, id))
    .orderBy(desc(taxHistory.referenceMonth))
    .limit(12);

  const oneflow = await getOneflowCredential(id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            Gestão Fiscal (Simples Nacional)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Faça upload dos recibos mensais do PGDAS para alimentar a Bússola Tributária do cliente.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário de Upload */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CloudArrowUp className="h-5 w-5 text-brand-500" />
            Upload de Recibo (PGDAS)
          </h2>
          <UploadPGDASForm companyId={id} />
        </div>

        {/* Resumo do Último Upload */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ChartBar className="h-5 w-5 text-slate-400" />
            Última Apuração
          </h2>
          {history[0] ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-10 w-10 text-slate-300 p-2 bg-slate-50 rounded-xl dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-500">Mês de Referência</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-lg">{history[0].referenceMonth}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl dark:bg-slate-800/50">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">RBA 12</p>
                  <p className="font-bold text-slate-900 dark:text-white text-lg">
                    {BRL.format(parseFloat(history[0].rba12))}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl dark:bg-slate-800/50">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Alíquota Efetiva</p>
                  <p className="font-bold text-slate-900 dark:text-white text-lg">
                    {history[0].effectiveRate}%
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Enquadramento: <strong>{history[0].taxBracket}</strong>
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-500 text-sm">Nenhum recibo processado para este cliente.</p>
            </div>
          )}
        </div>
      </div>

      {/* Integração Oneflow — só o contador vê/mexe, o cliente não tem acesso */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <ArrowsClockwise className="h-5 w-5 text-brand-500" />
          Integração Oneflow
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Token do Oneflow específico deste cliente — usado pra sincronizar NFS-e e lançamentos contábeis. Configuração
          interna, o cliente não vê isso no portal dele.
        </p>
        <OneflowSetupForm companyId={id} connected={oneflow.active} />
      </div>

      {/* Histórico Tabela */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Histórico de PGDAS</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs">Mês</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-500 text-xs">RBA12</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-500 text-xs">Alíquota</th>
              <th className="px-5 py-3 text-left font-semibold text-slate-500 text-xs">Anexo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.length > 0 ? history.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-200">{item.referenceMonth}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{BRL.format(parseFloat(item.rba12))}</td>
                <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{item.effectiveRate}%</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{item.taxBracket}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">Nenhum histórico encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
