'use client';

import { useAviso } from '@/components/ui/useAviso';
import { useState } from 'react';
import { Key, CheckCircle2, Loader2 } from 'lucide-react';
import { saveAsaasToken } from './actions';
import { Card } from '@/components/ui/Card';

interface AsaasSetupFormProps {
  initialToken: string;
  isConnected: boolean;
}

const field =
  'mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-xs font-bold text-ink-soft uppercase tracking-wide flex items-center gap-1.5';

export function AsaasSetupForm({ initialToken, isConnected }: AsaasSetupFormProps) {
  const { avisar, elemento: avisoEl } = useAviso();
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await saveAsaasToken(token);
      avisar('Integração salva.');
    } catch (err) {
      avisar('Não foi possível salvar as credenciais.', false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card level={1} className="p-6 sm:p-8 flex flex-col h-full justify-between">
      {avisoEl}
      <div>
        <h2 className="rotulo text-ink-soft mb-4">Credenciais do Gateway</h2>
        
        {isConnected && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-(--elev-1)">
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
              <Key className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" /> Chave de API (Access Token)
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
          className="w-full py-3 rounded-full text-xs font-bold text-hexxa-lime bg-hexxa-forest hover:brightness-110 shadow-(--elev-1) disabled:opacity-50 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Salvando...' : 'Salvar Conexão'}
        </button>
      </div>
    </Card>
  );
}
