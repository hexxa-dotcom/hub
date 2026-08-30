'use client';

import { useState } from 'react';
import { Plug, Save, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { saveOmieKeys, disconnectOmie } from './actions';
import { useRouter } from 'next/navigation';

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
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Chaves de API Omie</h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Conexão segura com seu painel Omie / OneFlow.</p>
          </div>
        </div>

        {isConnected ? (
          <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">Chaves salvas — sincronização automática ainda não disponível</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Suas chaves da Omie estão salvas, mas o envio automático de lançamentos pagos pro seu balanço contábil ainda está em desenvolvimento. Continue exportando OFX/CSV enquanto isso.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">Integração Inativa</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Configure as chaves abaixo para habilitar o envio automático dos fechamentos ao ERP.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form id="omie-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">
              App Key
            </label>
            <input
              type="text"
              value={appKey}
              onChange={e => setAppKey(e.target.value)}
              placeholder="Ex: 3833215570..."
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#121614] px-4 py-2.5 text-sm outline-none transition-all focus:border-[#1E3328] focus:ring-1 focus:ring-[#1E3328] dark:focus:border-[#DFFFAE] dark:focus:ring-[#DFFFAE] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">
              App Secret
            </label>
            <input
              type="password"
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              placeholder="Ex: 729b12e3a..."
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#121614] px-4 py-2.5 text-sm outline-none transition-all focus:border-[#1E3328] focus:ring-1 focus:ring-[#1E3328] dark:focus:border-[#DFFFAE] dark:focus:ring-[#DFFFAE] font-mono"
            />
          </div>
        </form>
      </div>

      <div className="mt-8 pt-4 border-t border-black/5 dark:border-white/10 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="submit"
          form="omie-form"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isConnected ? 'Atualizar Chaves' : 'Conectar Conta'}
        </button>

        {isConnected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-6 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 shadow-sm transition-all hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
          >
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
