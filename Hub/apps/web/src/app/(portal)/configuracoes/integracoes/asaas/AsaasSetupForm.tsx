'use client';

import { useState } from 'react';
import { Key, CheckCircle2, Loader2 } from 'lucide-react';
import { saveAsaasToken } from './actions';

interface AsaasSetupFormProps {
  initialToken: string;
  isConnected: boolean;
}

const field =
  'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide flex items-center gap-1.5';

export function AsaasSetupForm({ initialToken, isConnected }: AsaasSetupFormProps) {
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await saveAsaasToken(token);
      alert('Integração salva com sucesso!');
    } catch (err) {
      alert('Erro ao salvar as credenciais.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm flex flex-col h-full justify-between">
      <div>
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] mb-4">Credenciais do Gateway</h2>
        
        {isConnected && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">Integração Ativa</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Sua conexão com o Asaas está ativa.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={lbl}>
              <Key className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" /> Chave de API (Access Token)
            </label>
            <input 
              type="password" 
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Cole sua chave de API (Ex: $aact_...)"
              className={field}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/10">
        <button 
          onClick={handleSave}
          disabled={!token || loading}
          className="w-full py-3 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] disabled:opacity-50 transition-all shadow-sm hover:scale-105 inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Salvando...' : 'Salvar Conexão'}
        </button>
      </div>
    </div>
  );
}

