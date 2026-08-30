'use client';

import { useState } from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
// import { simulateTaxAction } from './actions';

export function TaxSimulatorForm() {
  const [rba12, setRba12] = useState('1500000');
  const [folha12, setFolha12] = useState('500000');
  const [faturamentoMes, setFaturamentoMes] = useState('100000');
  const [anexo, setAnexo] = useState('III');
  const [result, setResult] = useState<any>(null);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulação visual simplificada até ligar a Server Action com a TaxEngineService
    const r = parseFloat(rba12);
    const f = parseFloat(folha12);
    const cur = parseFloat(faturamentoMes);
    const fatorR = (r > 0 ? f / r : 0) * 100;

    let appliedAnnex = anexo;
    if (anexo === 'III' || anexo === 'V') {
      appliedAnnex = fatorR >= 28 ? 'III' : 'V';
    }

    setResult({
      fatorR: fatorR.toFixed(2),
      appliedAnnex,
      mockValue: (cur * 0.1).toFixed(2), // Mock para a UI
      traceId: 'trace-mock-1234',
    });
  };

  return (
    <div className="bg-[#FEFDF3] dark:bg-[#121614] rounded-2xl border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs">
      <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">
            RBA 12 (Faturamento)
          </label>
          <input 
            type="number" 
            value={rba12}
            onChange={(e) => setRba12(e.target.value)}
            className="w-full bg-white dark:bg-[#1A201C] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] dark:focus:border-[#DFFFAE]" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">
            Folha Acumulada 12m
          </label>
          <input 
            type="number" 
            value={folha12}
            onChange={(e) => setFolha12(e.target.value)}
            className="w-full bg-white dark:bg-[#1A201C] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] dark:focus:border-[#DFFFAE]" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1">
            Faturamento do Mês
          </label>
          <input 
            type="number" 
            value={faturamentoMes}
            onChange={(e) => setFaturamentoMes(e.target.value)}
            className="w-full bg-white dark:bg-[#1A201C] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] dark:focus:border-[#DFFFAE]" 
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full bg-[#2F4A3C] dark:bg-[#DFFFAE] text-white dark:text-[#1E3328] rounded-xl px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm">
            <Play className="h-4 w-4 fill-current" />
            Calcular Prova Real
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 space-y-4 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-[#2F4A3C] dark:text-[#DFFFAE] mb-2">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">Resultado Auditado</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4EFE4]/60 dark:bg-[#2F4A3C]/20 rounded-xl p-3 border border-black/5 dark:border-[#DFFFAE]/20">
              <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase">Fator R</p>
              <p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">{result.fatorR}%</p>
            </div>
            <div className="bg-[#F4EFE4]/60 dark:bg-[#2F4A3C]/20 rounded-xl p-3 border border-black/5 dark:border-[#DFFFAE]/20">
              <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase">Anexo Aplicado</p>
              <p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">Anexo {result.appliedAnnex}</p>
            </div>
            <div className="bg-[#F4EFE4]/60 dark:bg-[#2F4A3C]/20 rounded-xl p-3 border border-black/5 dark:border-[#DFFFAE]/20">
              <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase">Imposto Previsto</p>
              <p className="font-bold text-[#231F20] dark:text-[#FEFDF3]">R$ {result.mockValue}</p>
            </div>
            <div className="bg-[#F4EFE4]/60 dark:bg-[#2F4A3C]/20 rounded-xl p-3 border border-black/5 dark:border-[#DFFFAE]/20">
              <p className="text-[10px] font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase">ID Trace</p>
              <p className="font-mono text-xs text-[#231F20] dark:text-[#FEFDF3] mt-1">{result.traceId}</p>
            </div>
          </div>
          
          <div className="bg-black/5 dark:bg-black/40 rounded-xl p-4 font-mono text-xs text-[#6E6A61] dark:text-[#A8A49C] overflow-x-auto">
            {'// Trace Log: Proof of Calculation (Breve Server Action retornará o JSON completo da Core Engine)'}
            <br />
            {JSON.stringify(result, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
