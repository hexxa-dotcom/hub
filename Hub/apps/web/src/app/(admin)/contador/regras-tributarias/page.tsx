import { getDb, taxAnnexBracket, taxRegimeSetting, companyTaxProfile, withDbTimeout } from '@hexxa/db';
import { ShieldAlert, Info, Settings2, Calculator, Users } from 'lucide-react';
import Link from 'next/link';
import { TaxSimulatorForm } from './TaxSimulatorForm';

export const dynamic = 'force-dynamic';

export default async function RegrasTributariasPage() {
  const db = getDb();
  
  // No mundo real, faríamos query no banco aqui. Para o MVP, mockamos os resultados caso não existam.
  const [brackets, settings, profiles] = await withDbTimeout(
    Promise.all([
      db.select().from(taxAnnexBracket).limit(10),
      db.select().from(taxRegimeSetting).limit(10),
      db.select().from(companyTaxProfile).limit(10),
    ]),
    8000
  ).catch(() => [[], [], []]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif font-bold text-2xl text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
          Motor Tributário Hexx
        </h1>
        <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          Gestão centralizada de regras, tabelas do Simples Nacional, Fator R e simulador com cálculo rastreável.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="md:col-span-1 space-y-2">
          <Link href="#tabelas" className="flex items-center gap-3 p-3 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl font-medium text-sm text-[#231F20] dark:text-[#FEFDF3] shadow-sm">
            <Calculator className="h-4 w-4" /> Tabelas (Anexos)
          </Link>
          <Link href="#parametros" className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl font-medium text-sm text-[#6E6A61] dark:text-[#A8A49C] transition-colors">
            <Settings2 className="h-4 w-4" /> Fator R & Retenções
          </Link>
          <Link href="#clientes" className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl font-medium text-sm text-[#6E6A61] dark:text-[#A8A49C] transition-colors">
            <Users className="h-4 w-4" /> Matriz de Clientes
          </Link>
          <Link href="#simulador" className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl font-medium text-sm text-[#6E6A61] dark:text-[#A8A49C] transition-colors">
            <ShieldAlert className="h-4 w-4" /> Auditor Visual
          </Link>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-8">
          
          {/* Section: Tabelas */}
          <section id="tabelas" className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
            <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3] mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              Tabelas Oficiais da Legislação
            </h2>
            <div className="bg-[#FEFDF3] dark:bg-[#121614] rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-black/5 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">Anexo</th>
                    <th className="px-4 py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">Faixa (RBT12)</th>
                    <th className="px-4 py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">Alíquota Nominal</th>
                    <th className="px-4 py-3 font-bold text-[#231F20] dark:text-[#FEFDF3]">Dedução</th>
                  </tr>
                </thead>
                <tbody>
                  {brackets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#6E6A61] dark:text-[#A8A49C]">
                        Tabelas oficiais serão injetadas via seed no banco de dados.
                      </td>
                    </tr>
                  ) : (
                    brackets.map(b => (
                      <tr key={b.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-4 py-3">Anexo {b.annex}</td>
                        <td className="px-4 py-3">Faixa {b.bracket}</td>
                        <td className="px-4 py-3">{Number(b.nominalRate).toFixed(2)}%</td>
                        <td className="px-4 py-3">R$ {Number(b.deductionAmount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs flex items-center gap-1.5 text-[#6E6A61] dark:text-[#A8A49C]">
              <Info className="h-3 w-3" />
              As tabelas possuem controle temporal (valid_from). Nunca sobrescreva; insira uma nova versão em caso de mudança na Lei.
            </p>
          </section>

          {/* Section: Simulador */}
          <section id="simulador" className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
            <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3] mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              Auditor e Simulador de Impostos
            </h2>
            <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C] mb-6">
              Use esta ferramenta para testar o Motor Tributário do Hexx Hub. O cálculo será processado 100% no servidor (pure function) e um Trace de Auditoria será gerado.
            </p>
            
            <TaxSimulatorForm />
            
          </section>

        </div>
      </div>
    </div>
  );
}
