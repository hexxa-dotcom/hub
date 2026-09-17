'use client';

import { useState } from 'react';
import { Save, CheckCircle2, Circle, ExternalLink, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { lb, fi } from '@/components/contador/AdminUI';
import { saveAsaasPlatformConfigAction, type AsaasPlatformStatus } from './actions';

type SetupStep = {
  id: number;
  label: string;
  detail: string;
  link?: { href: string; text: string };
  done: boolean;
};

export function AsaasSetup({ initial }: { initial: AsaasPlatformStatus }) {
  const [env, setEnv] = useState<'sandbox' | 'production'>(initial.env);
  const [apiKey, setApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);
  const [hasWebhookToken, setHasWebhookToken] = useState(initial.hasWebhookToken);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/asaas`
    : 'https://seu-dominio.com/api/webhooks/asaas';

  const steps: SetupStep[] = [
    {
      id: 1,
      label: 'Criar conta no Asaas',
      detail: 'Acesse o Asaas e crie sua conta. O sandbox é gratuito e não exige documentos.',
      link: { href: 'https://www.asaas.com', text: 'Abrir asaas.com →' },
      done: hasApiKey,
    },
    {
      id: 2,
      label: 'Gerar chave de API',
      detail: 'No Asaas: Minha conta → Configurações → Integrações → Chave de API → Gerar nova chave.',
      done: hasApiKey,
    },
    {
      id: 3,
      label: 'Colar a chave abaixo e salvar',
      detail: 'Cole no campo "Chave de API Asaas" e clique em Salvar configurações.',
      done: hasApiKey,
    },
    {
      id: 4,
      label: 'Configurar webhook no Asaas',
      detail: 'No Asaas: Minha conta → Configurações → Notificações → Webhook → Adicionar URL abaixo.',
      done: hasWebhookToken,
    },
    {
      id: 5,
      label: 'Definir um token secreto do webhook',
      detail: 'Crie qualquer string segura (ex: use um gerador de senhas) e configure o mesmo valor no Asaas e no campo abaixo.',
      done: hasWebhookToken,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  async function salvar() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await saveAsaasPlatformConfigAction({ env, apiKey: apiKey || undefined, webhookToken: webhookToken || undefined });
      setSaveMsg(res.message);
      if (apiKey.trim()) setHasApiKey(true);
      if (webhookToken.trim()) setHasWebhookToken(true);
      setApiKey('');
      setWebhookToken('');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3 rounded-2xl bg-black/5 dark:bg-white/5 p-3.5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">
              {allDone ? '✅ Integração configurada' : `${completedCount} de ${steps.length} etapas concluídas`}
            </p>
            <span className={`text-xs font-bold ${allDone ? 'text-emerald-600' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
              {Math.round((completedCount / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-600' : 'bg-[#1E3328] dark:bg-[#DFFFAE]'}`}
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2.5">
        {steps.map(s => (
          <li key={s.id} className={`flex gap-3 rounded-2xl p-3.5 border ${s.done ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-black/5 dark:border-white/10 bg-[#F5F6F4] dark:bg-[#121614]'}`}>
            <span className="mt-0.5 shrink-0">
              {s.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <Circle className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />}
            </span>
            <div className="min-w-0">
              <p className={`text-xs sm:text-sm font-bold ${s.done ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-[#231F20] dark:text-[#F5F6F4]'}`}>
                {s.id}. {s.label}
              </p>
              {!s.done && <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{s.detail}</p>}
              {!s.done && s.link && (
                <a href={s.link.href} target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                  {s.link.text} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Ambiente */}
      <div>
        <label className={lb}>Ambiente</label>
        <div className="mt-1.5 flex gap-2">
          {(['sandbox', 'production'] as const).map(e => (
            <button key={e} type="button" onClick={() => setEnv(e)}
              className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${env === e ? 'bg-[#1E3328] text-[#DFFFAE] shadow-xs' : 'border border-black/10 dark:border-white/10 text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5'}`}>
              {e === 'sandbox' ? '🧪 Sandbox (testes)' : '🚀 Produção'}
            </button>
          ))}
        </div>
        {env === 'sandbox' && (
          <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            ⚠ Sandbox — cobranças não são reais. Troque para Produção antes de ir ao ar.
          </p>
        )}
      </div>

      {/* API Key */}
      <div>
        <label className={lb}>Chave de API Asaas {hasApiKey && <span className="text-emerald-600 dark:text-emerald-400 normal-case font-semibold">(já configurada — cole uma nova só pra trocar)</span>}</label>
        <div className="relative mt-1.5">
          <input
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasApiKey ? '••••••••••••••••' : (env === 'sandbox' ? '$aact_YTU5YTE0M2M...' : '$aact_prod_...')}
            className={`${fi} pr-10`}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Cole aqui a chave gerada no Asaas. Fica cifrada no banco (AES-256), nunca em texto puro.</p>
      </div>

      {/* Webhook URL */}
      <div>
        <label className={lb}>URL do Webhook (cole no Asaas)</label>
        <p className="mt-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-[#F5F6F4] dark:bg-[#121614] px-4 py-2.5 text-xs font-mono text-[#231F20] dark:text-[#F5F6F4] break-all">{webhookUrl}</p>
      </div>

      {/* Webhook Token */}
      <div>
        <label className={lb}>Token secreto do Webhook {hasWebhookToken && <span className="text-emerald-600 dark:text-emerald-400 normal-case font-semibold">(já configurado)</span>}</label>
        <input
          type="text"
          value={webhookToken}
          onChange={e => setWebhookToken(e.target.value)}
          placeholder={hasWebhookToken ? '••••••••' : 'Ex: hexxa_wh_2026_alguma_string_segura'}
          className={`mt-1.5 ${fi}`}
        />
        <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Configure o mesmo token aqui e no campo "Token" do webhook no Asaas para autenticar as notificações.</p>
      </div>

      {!allDone && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Complete a chave de API e o token do webhook acima e clique em Salvar — sem isso a cobrança recorrente e a baixa automática de pagamento não funcionam.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button onClick={salvar} disabled={saving}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-white transition-all shadow-xs disabled:opacity-60 ${saveMsg && !saveMsg.startsWith('Falha') ? 'bg-emerald-600' : 'bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE]'}`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando…' : saveMsg ? saveMsg : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
