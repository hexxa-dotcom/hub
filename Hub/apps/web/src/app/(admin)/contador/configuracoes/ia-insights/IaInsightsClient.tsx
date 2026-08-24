'use client';

import { useState } from 'react';
import { Sparkles, ShieldCheck, KeyRound, CheckCircle2, X, Loader2, Trash2 } from 'lucide-react';
import { Section, fi, lb } from '@/components/contador/AdminUI';
import {
  type AiInsightSettings,
  setAiInsightEnabledAction,
  saveAiInsightApiKeyAction,
  removeAiInsightApiKeyAction,
  setAiInsightSectionAction,
} from './actions';

function MasterToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${enabled ? 'bg-[#1E3328] dark:bg-[#DFFFAE]' : 'bg-black/15 dark:bg-white/15'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#1E3328] shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function IaInsightsClient({ initial }: { initial: AiInsightSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);
  const [provider, setProvider] = useState(initial.provider);
  const [sections, setSections] = useState(initial.sections);
  const [keyInput, setKeyInput] = useState('');
  const [keyProvider, setKeyProvider] = useState<'anthropic' | 'gemini'>(initial.provider);
  const [savingKey, setSavingKey] = useState(false);
  const [busyMaster, setBusyMaster] = useState(false);
  const [busySection, setBusySection] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleToggleMaster(next: boolean) {
    if (next && !hasApiKey) {
      setError('Cadastre uma chave da API antes de habilitar.');
      return;
    }
    setBusyMaster(true);
    setError(null);
    try {
      await setAiInsightEnabledAction(next);
      setEnabled(next);
      flash(next ? 'Hexxa Insights habilitada.' : 'Hexxa Insights desabilitada.');
    } finally {
      setBusyMaster(false);
    }
  }

  async function handleSaveKey() {
    setSavingKey(true);
    setError(null);
    const res = await saveAiInsightApiKeyAction(keyInput, keyProvider);
    setSavingKey(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setHasApiKey(true);
    setProvider(keyProvider);
    setKeyInput('');
    flash(res.message);
  }

  async function handleRemoveKey() {
    if (!confirm('Remover a chave da API? Isso também desabilita a Hexxa Insights.')) return;
    await removeAiInsightApiKeyAction();
    setHasApiKey(false);
    setEnabled(false);
    flash('Chave removida.');
  }

  async function handleToggleSection(key: string, next: boolean) {
    setBusySection(key);
    try {
      await setAiInsightSectionAction(key, next);
      setSections((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: next } : s)));
    } finally {
      setBusySection(null);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {message}
        </div>
      )}

      <Section
        icon={<Sparkles className="h-4 w-4" />}
        title="Hexxa Insights"
        desc="Dicas contextuais geradas por IA nas telas do sistema — contábil, fiscal, financeiro e legal."
        fullWidth
      >
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
          <div>
            <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Habilitar Hexxa Insights</p>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Liga a feature pra toda a plataforma. Cada seção abaixo pode ser desligada individualmente.</p>
          </div>
          <MasterToggle enabled={enabled} disabled={busyMaster} onChange={handleToggleMaster} />
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#2F4A3C] dark:text-[#DFFFAE]" />
            <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Chave da API</p>
          </div>

          {hasApiKey ? (
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#EFFFD6] dark:bg-[#1E3328] px-4 py-3">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                <CheckCircle2 className="h-4 w-4" /> Chave do {provider === 'gemini' ? 'Gemini' : 'Anthropic'} configurada e cifrada no banco
              </span>
              <button type="button" onClick={handleRemoveKey} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex gap-2">
                {(['anthropic', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setKeyProvider(p)}
                    className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${keyProvider === p ? 'bg-[#1E3328] text-[#DFFFAE]' : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C]'}`}
                  >
                    {p === 'anthropic' ? 'Anthropic (Claude)' : 'Google (Gemini)'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={keyProvider === 'gemini' ? 'Chave do Google AI Studio...' : 'sk-ant-...'}
                  className={`flex-1 min-w-[240px] ${fi}`}
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={savingKey || !keyInput.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-50"
                >
                  {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </button>
              </div>
              {keyProvider === 'gemini' && (
                <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
                  Gere a chave em aistudio.google.com/apikey — é diferente da assinatura Gemini Pro (essa não dá acesso à API).
                </p>
              )}
            </div>
          )}
          {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-black/5 dark:bg-white/5 p-4">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
            A chave nunca é exibida depois de salva (só "configurada"/"não configurada") e é armazenada cifrada
            (AES-256-GCM) no banco — nunca em texto puro, nunca enviada ao navegador do cliente. Só usuários do
            e-mail admin da contabilidade acessam esta tela e estas ações.
          </p>
        </div>
      </Section>

      <Section icon={<Sparkles className="h-4 w-4" />} title="Seções com dicas ativas" desc="Desligue individualmente qualquer tela onde a dica não fizer sentido." fullWidth>
        <div className="divide-y divide-black/5 dark:divide-white/10">
          {sections.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-[#231F20] dark:text-[#FEFDF3]">{s.label}</span>
              <MasterToggle enabled={s.enabled} disabled={busySection === s.key} onChange={(v) => handleToggleSection(s.key, v)} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
