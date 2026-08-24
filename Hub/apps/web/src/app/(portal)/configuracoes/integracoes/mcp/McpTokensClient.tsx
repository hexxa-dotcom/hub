'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Copy, CheckCircle2, X, KeyRound, AlertTriangle, Eye, PencilLine } from 'lucide-react';
import { listApiTokens, createApiToken, revokeApiToken, type ApiTokenRow, type ApiTokenScope } from './actions';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const field =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] px-3.5 py-2 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';

function NewTokenModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#F4EFE4] dark:bg-[#1A201C] w-full max-w-lg rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20">
          <h2 className="text-base font-serif font-bold text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Token criado
          </h2>
          <button onClick={onClose} className="p-2 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="flex items-center gap-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 p-3 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Copie agora — por segurança, esse valor não fica salvo em nenhum lugar e não aparece de novo.
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-black/30 p-3.5 font-mono text-xs break-all text-[#231F20] dark:text-[#FEFDF3]">
            {token}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-colors"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar token'}
          </button>
          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
            Cole esse valor como Bearer token na configuração do MCP no Claude Desktop, ChatGPT ou outro cliente MCP.
          </p>
        </div>
      </div>
    </div>
  );
}

export function McpTokensClient() {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('read');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTokens(await listApiTokens());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Dê um nome pro token.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { token } = await createApiToken(name, scope);
      setNewToken(token);
      setName('');
      setScope('read');
      setShowForm(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao criar token.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    try {
      await revokeApiToken(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Tokens Ativos</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" /> Novo token
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#DFFFAE] bg-[#EFFFD6]/50 dark:bg-[#1E3328]/30 p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Nome do token</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Claude Desktop, Sistema de faturamento X…"
              className={`mt-1 ${field}`}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Permissão</label>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('read')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${
                  scope === 'read'
                    ? 'border-[#1E3328] bg-[#EFFFD6] dark:bg-[#1E3328]'
                    : 'border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] hover:bg-black/5'
                }`}
              >
                <Eye className="h-4 w-4 mt-0.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                <span>
                  <span className="block text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Só leitura</span>
                  <span className="block text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Assistente de IA (MCP) — só consulta</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScope('write')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${
                  scope === 'write'
                    ? 'border-[#1E3328] bg-[#EFFFD6] dark:bg-[#1E3328]'
                    : 'border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] hover:bg-black/5'
                }`}
              >
                <PencilLine className="h-4 w-4 mt-0.5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
                <span>
                  <span className="block text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Leitura e escrita</span>
                  <span className="block text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Integração externa — também lança despesa/faturamento</span>
                </span>
              </button>
            </div>
          </div>
          {err && <p className="text-xs font-bold text-red-700">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[#6E6A61]">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs font-bold">Carregando…</span>
        </div>
      ) : tokens.length === 0 ? (
        <p className="rounded-2xl bg-[#F4EFE4] dark:bg-[#1A201C] p-6 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Nenhum token criado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 p-3.5 ${t.revoked ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{t.name}</p>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.scope === 'write'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-[#EFFFD6] dark:bg-[#1E3328] text-[#2F4A3C] dark:text-[#DFFFAE]'
                    }`}
                  >
                    {t.scope === 'write' ? <PencilLine className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {t.scope === 'write' ? 'Leitura e escrita' : 'Só leitura'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#6E6A61] dark:text-[#A8A49C]">
                  {t.tokenPrefix}… · criado em {fmtDate(t.createdAt)}
                  {t.lastUsedAt ? ` · usado em ${fmtDate(t.lastUsedAt)}` : ' · nunca usado'}
                  {t.revoked ? ' · revogado' : ''}
                </p>
              </div>
              {!t.revoked && (
                <button
                  type="button"
                  title="Revogar"
                  onClick={() => handleRevoke(t.id)}
                  disabled={busyId === t.id}
                  className="rounded-full p-2 text-[#6E6A61] hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {newToken && <NewTokenModal token={newToken} onClose={() => setNewToken(null)} />}
    </div>
  );
}
