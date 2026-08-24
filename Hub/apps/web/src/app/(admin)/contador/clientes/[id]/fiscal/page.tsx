export const dynamic = 'force-dynamic';
import { taxHistory, getDb, eq, desc } from '@hexxa/db';
import Link from 'next/link';
import { ArrowLeft, UploadCloud, BarChart3, Calendar, RotateCw } from 'lucide-react';
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
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/contador/clientes/${id}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
            Gestão Fiscal (Simples Nacional)
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">
            Faça upload dos recibos mensais do PGDAS para alimentar a Bússola Tributária do cliente.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário de Upload */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] mb-4 flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Upload de Recibo (PGDAS)
          </h2>
          <UploadPGDASForm companyId={id} />
        </div>

        {/* Resumo do Último Upload */}
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            Última Apuração
          </h2>
          {history[0] ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-10 w-10 text-[#2F4A3C] dark:text-[#DFFFAE] p-2 bg-[#EFFFD6] dark:bg-[#2F4A3C]/40 rounded-2xl" />
                <div>
                  <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Mês de Referência</p>
                  <p className="font-serif font-bold text-slate-900 dark:text-white text-lg">{history[0].referenceMonth}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">RBA 12</p>
                  <p className="font-bold text-[#231F20] dark:text-[#FEFDF3] text-lg">
                    {BRL.format(parseFloat(history[0].rba12))}
                  </p>
                </div>
                <div className="bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">Alíquota Efetiva</p>
                  <p className="font-bold text-[#231F20] dark:text-[#FEFDF3] text-lg">
                    {history[0].effectiveRate}%
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-2">
                Enquadramento: <strong className="text-[#231F20] dark:text-[#FEFDF3]">{history[0].taxBracket}</strong>
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum recibo processado para este cliente.</p>
            </div>
          )}
        </div>
      </div>

      {/* Integração Oneflow — só o contador vê/mexe, o cliente não tem acesso */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] mb-1 flex items-center gap-2">
          <RotateCw className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          Integração Oneflow
        </h2>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mb-4">
          Token do Oneflow específico deste cliente — usado pra sincronizar NFS-e e lançamentos contábeis. Configuração
          interna, o cliente não vê isso no portal dele.
        </p>
        <OneflowSetupForm companyId={id} connected={oneflow.active} />
      </div>

      {/* Histórico Tabela */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md shadow-sm overflow-hidden">
        <div className="p-5 border-b border-black/5 dark:border-white/10">
          <h2 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Histórico de PGDAS</h2>
        </div>
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10">
              <th className="px-5 py-3 text-left font-bold text-[#6E6A61] dark:text-[#A8A49C]">Mês</th>
              <th className="px-5 py-3 text-right font-bold text-[#6E6A61] dark:text-[#A8A49C]">RBA12</th>
              <th className="px-5 py-3 text-right font-bold text-[#6E6A61] dark:text-[#A8A49C]">Alíquota</th>
              <th className="px-5 py-3 text-left font-bold text-[#6E6A61] dark:text-[#A8A49C]">Anexo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10 bg-[#FEFDF3] dark:bg-[#121614]">
            {history.length > 0 ? history.map((item) => (
              <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 font-medium text-[#231F20] dark:text-[#FEFDF3]">{item.referenceMonth}</td>
                <td className="px-5 py-3 text-right text-[#6E6A61] dark:text-[#A8A49C]">{BRL.format(parseFloat(item.rba12))}</td>
                <td className="px-5 py-3 text-right font-bold text-[#231F20] dark:text-[#FEFDF3]">{item.effectiveRate}%</td>
                <td className="px-5 py-3 text-[#6E6A61] dark:text-[#A8A49C]">{item.taxBracket}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-[#6E6A61] dark:text-[#A8A49C] text-xs">Nenhum histórico encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

