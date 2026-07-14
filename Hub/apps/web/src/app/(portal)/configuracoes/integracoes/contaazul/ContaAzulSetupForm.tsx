'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Key, Lock, CheckCircle2 } from 'lucide-react';

interface ContaAzulSetupFormProps {
  initialClientId: string;
  initialClientSecret: string;
  isConnected: boolean;
}

export function ContaAzulSetupForm({ initialClientId, initialClientSecret, isConnected }: ContaAzulSetupFormProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState(initialClientSecret);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/contaazul/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret })
      });
      if (!res.ok) throw new Error('Erro ao salvar.');
      
      // Se salvou, redireciona para autorizar (OAuth)
      window.location.href = '/api/integrations/contaazul/authorize';
    } catch (err) {
      alert('Erro ao salvar as credenciais.');
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
                Sua conexão com a Conta Azul está validada e ativa. Você pode atualizar as chaves abaixo caso precise refazer a autorização.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 flex-1">
          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-brand-500" /> Client ID
            </label>
            <input 
              type="text" 
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="Cole o Client ID aqui"
              className="w-full bg-surface-card border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-brand-500" /> Client Secret
            </label>
            <input 
              type="password" 
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder="Cole o segredo aqui"
              className="w-full bg-surface-card border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-line">
          <button 
            onClick={handleSave}
            disabled={!clientId || !clientSecret || loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-brand-500/20 active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : (isConnected ? 'Atualizar e Reautorizar' : 'Salvar e Autorizar na Conta Azul')}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
