'use client';

import { useAviso } from '@/components/ui/useAviso';
import { useState } from 'react';
import { Link2, CheckCircle2, Loader2, Copy, AlertTriangle, RotateCw } from 'lucide-react';
import { gerarWebhookSecretAction, desativarWebhookAction } from './actions';
import { Card } from '@/components/ui/Card';

interface WebhookRepasseSetupFormProps {
  isConnected: boolean;
  webhookUrl: string;
}

const boxClass =
  'rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-xs font-mono text-ink break-all';

export function WebhookRepasseSetupForm({ isConnected, webhookUrl }: WebhookRepasseSetupFormProps) {
  const { avisar, elemento: avisoEl } = useAviso();
  const [loading, setLoading] = useState(false);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [connected, setConnected] = useState(isConnected);

  async function handleGerar() {
    if (connected && !confirm('Gerar um novo segredo invalida o atual — você vai precisar atualizar no painel do seu SaaS. Continuar?')) return;
    setLoading(true);
    try {
      const { secret } = await gerarWebhookSecretAction();
      setFreshSecret(secret);
      setConnected(true);
    } catch {
      avisar('Não foi possível gerar o segredo do webhook.', false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDesativar() {
    if (!confirm('Desativar este webhook? Novos eventos do seu SaaS passam a ser ignorados até você gerar um novo segredo.')) return;
    setLoading(true);
    try {
      await desativarWebhookAction();
      setConnected(false);
      setFreshSecret(null);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <Card level={1} className="p-6 sm:p-8 flex flex-col h-full justify-between">
      {avisoEl}
      <div className="space-y-5">
        <h2 className="rotulo text-ink-soft">Conexão do Webhook</h2>

        {connected && (
          <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-(--elev-1)">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">Webhook ativo</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Pronto para receber eventos do SaaS do cliente.</p>
            </div>
          </div>
        )}

        <div>
          <label className="rotulo text-ink-soft flex items-center gap-1.5 mb-1.5">
            <Link2 className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" /> URL do Webhook
          </label>
          <div className="flex items-center gap-2">
            <div className={`flex-1 ${boxClass}`}>{webhookUrl}</div>
            <button
              type="button"
              onClick={() => copy(webhookUrl)}
              className="rounded-xl p-2.5 border border-black/5 dark:border-white/5 bg-surface-card hover:brightness-105 text-ink-soft hover:text-ink shadow-(--elev-1) transition-all shrink-0"
              title="Copiar URL"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {freshSecret && (
          <div>
            <label className="rotulo text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Segredo (copie agora — não será mostrado de novo)
            </label>
            <div className="flex items-center gap-2">
              <div className={`flex-1 ${boxClass} bg-amber-500/10 border-amber-500/30`}>{freshSecret}</div>
              <button
                type="button"
                onClick={() => copy(freshSecret)}
                className="rounded-xl p-2.5 border border-black/5 dark:border-white/5 bg-surface-card hover:brightness-105 text-ink-soft hover:text-ink shadow-(--elev-1) transition-all shrink-0"
                title="Copiar segredo"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-soft">Cole este valor no header <code>x-webhook-secret</code> configurado no painel do seu SaaS.</p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/10 space-y-2">
        <button
          onClick={handleGerar}
          disabled={loading}
          className="w-full py-3 rounded-full text-xs font-bold text-hexxa-lime bg-hexxa-forest hover:brightness-110 shadow-(--elev-1) disabled:opacity-50 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          {connected ? 'Rotacionar Segredo' : 'Gerar URL e Segredo'}
        </button>
        {connected && (
          <button
            onClick={handleDesativar}
            disabled={loading}
            className="w-full py-2.5 rounded-full text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-all"
          >
            Desativar Webhook
          </button>
        )}
      </div>
    </Card>
  );
}
