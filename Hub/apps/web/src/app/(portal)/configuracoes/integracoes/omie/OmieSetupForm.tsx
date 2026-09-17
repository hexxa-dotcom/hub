'use client';

import { useState } from 'react';
import { Plug, Save, Loader2, AlertTriangle } from 'lucide-react';
import { saveOmieKeys, disconnectOmie } from './actions';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';

export function OmieSetupForm({
  initialAppKey,
  initialAppSecret,
  isConnected,
}: {
  initialAppKey: string;
  initialAppSecret: string;
  isConnected: boolean;
}) {
  const [appKey, setAppKey] = useState(initialAppKey);
  const [appSecret, setAppSecret] = useState(initialAppSecret);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!appKey || !appSecret) {
      setError('Preencha a App Key e o App Secret.');
      return;
    }
    
    setLoading(true);
    setError('');

    const res = await saveOmieKeys(appKey, appSecret);
    
    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDisconnect() {
    setLoading(true);
    setError('');
    const res = await disconnectOmie();
    if (res.error) {
      setError(res.error);
    } else {
      setAppKey('');
      setAppSecret('');
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Card level={1} className="p-6 sm:p-8 flex flex-col justify-between h-full">
      <div>
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-ink">Chaves de API Omie</h2>
            <p className="text-xs text-ink-soft">Conexão segura com seu painel Omie / OneFlow.</p>
          </div>
        </div>

        {isConnected ? (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 shadow-(--elev-1)">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Chaves salvas — sincronização automática em fase final</h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300 mt-1">
                  Suas chaves da Omie estão salvas. O envio de lançamentos pagos para o balanço contábil pode ser acompanhado via relatórios e extratos OFX.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 shadow-(--elev-1)">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Integração Inativa</h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300 mt-1">
                  Configure as chaves abaixo para habilitar o envio automático dos fechamentos ao ERP.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-semibold text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        <form id="omie-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
              App Key
            </label>
            <input
              type="text"
              value={appKey}
              onChange={e => setAppKey(e.target.value)}
              placeholder="Ex: 3833215570..."
              className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
              App Secret
            </label>
            <input
              type="password"
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              placeholder="Ex: 729b12e3a..."
              className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime font-mono"
            />
          </div>
        </form>
      </div>

      <div className="mt-8 pt-4 border-t border-black/5 dark:border-white/10 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="submit"
          form="omie-form"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isConnected ? 'Atualizar Chaves' : 'Conectar Conta'}
        </button>

        {isConnected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-6 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-400 shadow-(--elev-1) transition-all hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
          >
            Desconectar
          </button>
        )}
      </div>
    </Card>
  );
}
