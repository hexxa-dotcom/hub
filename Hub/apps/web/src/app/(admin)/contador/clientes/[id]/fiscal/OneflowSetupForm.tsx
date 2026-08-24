'use client';

import { useState } from 'react';
import { CheckCircle, Spinner, WarningCircle, LinkBreak } from '@phosphor-icons/react';
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
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-900/10 p-3">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" /> Token do Oneflow conectado pra este cliente
          </span>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={saving}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            {saving ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <LinkBreak className="h-3.5 w-3.5" />}
            Desconectar
          </button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Token Oneflow deste cliente</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o Bearer token gerado no Oneflow pra este CNPJ"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Cada empresa tem seu próprio token no Oneflow — pegue no painel deles, no cadastro específico deste CNPJ.
            </p>
          </div>
          {err && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
              <WarningCircle className="h-3.5 w-3.5" /> {err}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Spinner className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Salvar token
          </button>
        </>
      )}
    </div>
  );
}
