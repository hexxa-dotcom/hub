'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Key, CheckCircle2 } from 'lucide-react';
import { saveAsaasToken } from './actions';

interface AsaasSetupFormProps {
  initialToken: string;
  isConnected: boolean;
}

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
    <GlassCard title="Credenciais da Integração">
      <div className="p-6 flex flex-col h-[calc(100%-60px)]">
        
        {isConnected && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-ok/10 border border-ok/20 rounded-2xl">
            <CheckCircle2 className="h-5 w-5 text-ok shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-ok mb-1">Integração Ativa</h4>
              <p className="text-xs text-ok/80">
                Sua conexão com o Asaas está ativa. Você pode atualizar a chave abaixo se necessário.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 flex-1">
          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-brand-500" /> Chave de API (Access Token)
            </label>
            <input 
              type="password" 
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Cole sua chave de API (Ex: $aact_...)"
              className="w-full bg-surface-card border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-line">
          <button 
            onClick={handleSave}
            disabled={!token || loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-brand-500/20 active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : 'Salvar Conexão'}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
