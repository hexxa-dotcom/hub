'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Unlink } from 'lucide-react';
import { saveOneflowToken, disconnectOneflow } from './actions';

export function OneflowSetupForm({ companyId, connected }: { companyId: string; connected: boolean }) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(connected);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      await saveOneflowToken(companyId, token);
      setOk(true);
      setToken('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectOneflow(companyId);
      setOk(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {ok ? (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Token do Oneflow conectado pra este cliente
          </span>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={saving}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#6E6A61] hover:text-red-600 dark:text-[#A8A49C] dark:hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            Desconectar
          </button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Token Oneflow deste cliente</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o Bearer token gerado no Oneflow pra este CNPJ"
              className="mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] transition-colors"
            />
            <p className="mt-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
              Cada empresa tem seu próprio token no Oneflow — pegue no painel deles, no cadastro específico deste CNPJ.
            </p>
          </div>
          {err && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {err}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] disabled:opacity-50 transition-all shadow-xs"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar token
          </button>
        </>
      )}
    </div>
  );
}

