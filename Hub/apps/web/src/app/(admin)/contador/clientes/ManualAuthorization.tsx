'use client';

import { useState } from 'react';
import { Loader2, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { authorizeClientByCnpjAction } from './actions';

export function ManualAuthorization() {
  const [cnpj, setCnpj] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (!cnpj) return;
    
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await authorizeClientByCnpjAction(cnpj);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Autorizado com sucesso!' });
        setCnpj('');
        // Fecha o popup depois de 3 segundos
        setTimeout(() => setIsOpen(false), 3000);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro inesperado ao autorizar.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={() => { setIsOpen(!isOpen); setMessage(null); }}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-xs"
      >
        <Unlock className="h-3.5 w-3.5" /> Liberação Manual
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <h3 className="mb-1 text-sm font-serif font-bold text-[#231F20] dark:text-[#FEFDF3]">Liberar Acesso sem Pagamento</h3>
          <p className="mb-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Digite o CNPJ da empresa que já se cadastrou no sistema (via /onboarding) para liberar o acesso ao painel imediatamente.
          </p>

          <form onSubmit={handleAuthorize} className="space-y-3">
            {message && (
              <div className={`p-3 text-xs rounded-2xl flex items-start gap-2 ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                {message.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            <div>
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 px-3.5 py-2 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] transition-colors"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="rounded-full px-3.5 py-1.5 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isLoading || !cnpj}
                className="inline-flex items-center justify-center rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-50 transition-all shadow-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

