'use client';

import { useState } from 'react';
import { Save, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { lb, fi } from '@/components/contador/AdminUI';
import { saveJevKeyAction } from './actions';

/** Troca da chave do Jev (TypeSafe), a IA que decide a conta de cada movimento do extrato. */
export function JevSetup({ origem }: { origem: 'TELA' | 'AMBIENTE' | null }) {
  const [chave, setChave] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [atual, setAtual] = useState(origem);

  async function salvar() {
    setSaving(true);
    setMsg(null);
    const r = await saveJevKeyAction(chave).catch(() => ({ ok: false, message: 'Falha ao salvar.' }));
    setMsg({ ok: r.ok, texto: r.message });
    if (r.ok) {
      setAtual('TELA');
      setChave('');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-black/5 dark:border-white/10 bg-[#F5F6F4] dark:bg-[#121614] px-4 py-3">
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          {atual === 'TELA' ? 'Usando a chave salva aqui.' : atual === 'AMBIENTE' ? 'Usando a chave do ambiente (.env / Vercel).' : 'Sem chave — o extrato usa o Gemini.'}
        </p>
        {atual ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Ligado</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]"><XCircle className="h-4 w-4" /> Desligado</span>
        )}
      </div>
      <div>
        <label className={lb}>Chave de API TypeSafe {atual && <span className="normal-case font-semibold text-emerald-600 dark:text-emerald-400">(cole uma nova só para trocar)</span>}</label>
        <div className="relative mt-1.5">
          <input type={show ? 'text' : 'password'} value={chave} onChange={(e) => setChave(e.target.value)} placeholder="apikey_…" className={`${fi} pr-10`} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">A chave é conferida na TypeSafe antes de salvar e fica cifrada no banco.</p>
      </div>
      <div className="flex items-center justify-end gap-3">
        {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{msg.texto}</p>}
        <button onClick={salvar} disabled={saving || !chave.trim()} className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-6 py-3 text-xs font-bold text-[#DFFFAE] shadow-xs transition-colors hover:bg-[#2F4A3C] disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Conferindo…' : 'Salvar chave'}
        </button>
      </div>
    </div>
  );
}
