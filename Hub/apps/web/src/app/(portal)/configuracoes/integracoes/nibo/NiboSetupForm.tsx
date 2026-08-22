'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Key, CheckCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

interface NiboSetupFormProps {
  initialApiToken: string;
  isConnected: boolean;
}

export function NiboSetupForm({ initialApiToken, isConnected }: NiboSetupFormProps) {
  const [apiToken, setApiToken] = useState(initialApiToken);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/nibo/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken })
      });
      if (!res.ok) throw new Error('Erro ao salvar.');
      
      router.push('/configuracoes/integracoes');
      router.refresh();
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
            <CheckCircle className="h-5 w-5 text-ok shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-ok mb-1">Integração Ativa</h4>
              <p className="text-xs text-ok/80">
                Sua conexão com o Nibo está validada. Você pode atualizar o Token de Acesso abaixo caso ele tenha expirado ou sido revogado no painel.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 flex-1">
          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-brand-500" /> Token de Acesso (API Token)
            </label>
            <input 
              type="password" 
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              placeholder="Cole seu token gerado no Nibo"
              className="w-full bg-surface-card border border-line rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-line">
          <button 
            onClick={handleSave}
            disabled={!apiToken || loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-brand-500/20 active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : (isConnected ? 'Atualizar Conexão' : 'Salvar e Conectar')}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
