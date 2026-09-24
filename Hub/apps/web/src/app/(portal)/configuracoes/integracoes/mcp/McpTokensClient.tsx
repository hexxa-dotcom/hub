'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Copy, CheckCircle2, X, KeyRound, AlertTriangle, Eye, PencilLine, ShieldCheck } from 'lucide-react';
import { listApiTokens, createApiToken, revokeApiToken, type ApiTokenRow, type ApiTokenScope } from './actions';
import { Card } from '@/components/ui/Card';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const field =
  'w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-3.5 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';

function NewTokenModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <Card level={2} tone="deep" className="card-finish w-full max-w-lg shadow-(--elev-3) overflow-hidden p-0">
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10">
          <h2 className="text-base font-serif font-bold text-ink flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" /> Token criado
          </h2>
          <button onClick={onClose} className="p-2 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Copie agora — por segurança, esse valor não fica salvo em nenhum lugar e não será exibido novamente.
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-3.5 font-mono text-xs break-all text-ink">
            {token}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar token'}
          </button>
          <p className="text-[11px] text-ink-soft">
            Cole esse valor como Bearer token na configuração do MCP no Claude Desktop, ChatGPT ou outro cliente MCP.
          </p>
        </div>
      </Card>
    </div>
  );
}

export function McpTokensClient({ isAdmin = false }: { isAdmin?: boolean }) {
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
      const list = await listApiTokens();
      setTokens(list);
    } catch (e: any) {
      setErr(e.message || 'Erro ao listar tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const res = await createApiToken(name, scope);
      setNewToken(res.token);
      setName('');
      setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Erro ao criar token.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Tem certeza? Esse token vai parar de funcionar imediatamente.')) return;
    setBusyId(id);
    try {
      await revokeApiToken(id);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Erro ao revogar token.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-serif font-bold text-ink">Tokens Ativos</h2>
          <p className="text-xs text-ink-soft">
            Chaves de autenticação do MCP e da API REST.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest hover:brightness-110 px-3.5 py-1.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Novo Token
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-surface-card border border-black/5 dark:border-white/5 p-4 shadow-(--elev-inset)"
        >
          <div>
            <label className="rotulo text-ink-soft">Nome do Token</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Claude Desktop, Sistema de faturamento X…"
              className={`mt-1.5 ${field}`}
            />
          </div>
          <div>
            <label className="rotulo text-ink-soft">Permissão</label>
            <div className={`mt-1.5 grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
              <button
                type="button"
                onClick={() => setScope('read')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-all ${
                  scope === 'read'
                    ? 'border-hexxa-forest bg-hexxa-forest/10 dark:border-hexxa-lime dark:bg-hexxa-lime/10'
                    : 'border-black/5 dark:border-white/5 bg-surface-card hover:bg-black/5'
                }`}
              >
                <Eye className="h-4 w-4 mt-0.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
                <span>
                  <span className="block text-xs font-bold text-ink">Só leitura</span>
                  <span className="block text-[11px] text-ink-soft">Consulta apenas esta empresa</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScope('write')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-all ${
                  scope === 'write'
                    ? 'border-hexxa-forest bg-hexxa-forest/10 dark:border-hexxa-lime dark:bg-hexxa-lime/10'
                    : 'border-black/5 dark:border-white/5 bg-surface-card hover:bg-black/5'
                }`}
              >
                <PencilLine className="h-4 w-4 mt-0.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
                <span>
                  <span className="block text-xs font-bold text-ink">Leitura e escrita</span>
                  <span className="block text-[11px] text-ink-soft">Integração externa — lança dados</span>
                </span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setScope('admin')}
                  className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-all ${
                    scope === 'admin'
                      ? 'border-hexxa-forest bg-hexxa-forest/10 dark:border-hexxa-lime dark:bg-hexxa-lime/10'
                      : 'border-black/5 dark:border-white/5 bg-surface-card hover:bg-black/5'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-hexxa-forest dark:text-hexxa-lime" />
                  <span>
                    <span className="block text-xs font-bold text-ink">Contador (Multi)</span>
                    <span className="block text-[11px] text-ink-soft">IA pode consultar qualquer cliente</span>
                  </span>
                </button>
              )}
            </div>
          </div>
          {err && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-black/5 dark:border-white/5 bg-surface-card px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1)"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> <span className="text-xs font-bold">Carregando…</span>
        </div>
      ) : tokens.length === 0 ? (
        <p className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-6 text-center text-xs text-ink-soft">
          Nenhum token criado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-2xl bg-surface-card border border-black/5 dark:border-white/5 shadow-(--elev-1) p-3.5 ${t.revoked ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-ink">{t.name}</p>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.scope === 'admin'
                        ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                        : t.scope === 'write'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        : 'bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime border border-hexxa-forest/20'
                    }`}
                  >
                    {t.scope === 'admin' ? (
                      <ShieldCheck className="h-2.5 w-2.5" />
                    ) : t.scope === 'write' ? (
                      <PencilLine className="h-2.5 w-2.5" />
                    ) : (
                      <Eye className="h-2.5 w-2.5" />
                    )}
                    {t.scope === 'admin' ? 'Contador (Multi)' : t.scope === 'write' ? 'Leitura e escrita' : 'Só leitura'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-ink-soft">
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
                  className="rounded-full p-2 text-ink-soft hover:bg-rose-500/10 hover:text-rose-600 transition-colors disabled:opacity-40"
                >
                  {busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {newToken && <NewTokenModal token={newToken} onClose={() => setNewToken(null)} />}
    </Card>
  );
}
