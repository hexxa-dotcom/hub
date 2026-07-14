'use client';

import { useState } from 'react';
import { Loader2, Unlock, AlertCircle, CheckCircle2 } from 'lucide-react';
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors"
      >
        <Unlock className="h-4 w-4" /> Liberação Manual
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Liberar Acesso sem Pagamento</h3>
          <p className="mb-4 text-xs text-slate-500">
            Digite o CNPJ da empresa que já se cadastrou no sistema (via /onboarding) para liberar o acesso ao painel imediatamente.
          </p>

          <form onSubmit={handleAuthorize} className="space-y-3">
            {message && (
              <div className={`p-2 text-xs rounded-xl flex items-start gap-1.5 ${message.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'}`}>
                {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <div>
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isLoading || !cnpj}
                className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
