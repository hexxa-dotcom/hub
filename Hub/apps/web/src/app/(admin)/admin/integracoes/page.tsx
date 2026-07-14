'use client';

import { useState } from 'react';
import { Save, Blocks, CreditCard, Key, CheckCircle2, Circle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Section, Toggle, SecretInput, CopyField, lb, fi } from '@/components/admin/AdminUI';

type SetupStep = {
  id: number;
  label: string;
  detail: string;
  link?: { href: string; text: string };
  done: boolean;
};

function AsaasSetup() {
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [show, setShow] = useState(false);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/asaas/webhooks`
    : 'https://seu-dominio.com/api/asaas/webhooks';

  const steps: SetupStep[] = [
    {
      id: 1,
      label: 'Criar conta no Asaas',
      detail: 'Acesse o Asaas e crie sua conta. O sandbox é gratuito e não exige documentos.',
      link: { href: 'https://www.asaas.com', text: 'Abrir asaas.com →' },
      done: false,
    },
    {
      id: 2,
      label: 'Gerar chave de API',
      detail: 'No Asaas: Minha conta → Configurações → Integrações → Chave de API → Gerar nova chave.',
      done: !!apiKey,
    },
    {
      id: 3,
      label: 'Colar a chave abaixo e salvar',
      detail: 'Cole no campo "Chave de API Asaas" e clique em Salvar configurações.',
      done: !!apiKey,
    },
    {
      id: 4,
      label: 'Configurar webhook no Asaas',
      detail: 'No Asaas: Minha conta → Configurações → Notificações → Webhook → Adicionar URL abaixo.',
      done: !!webhookToken,
    },
    {
      id: 5,
      label: 'Definir um token secreto do webhook',
      detail: 'Crie qualquer string segura (ex: use um gerador de senhas) e configure o mesmo valor no Asaas e no campo abaixo.',
      done: !!webhookToken,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {allDone ? '✅ Integração configurada' : `${completedCount} de ${steps.length} etapas concluídas`}
            </p>
            <span className={`text-xs font-semibold ${allDone ? 'text-green-600' : 'text-slate-400'}`}>
              {Math.round((completedCount / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-1.5 rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2">
        {steps.map(s => (
          <li key={s.id} className={`flex gap-3 rounded-xl p-3 ${s.done ? 'bg-green-50 dark:bg-green-900/10' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
            <span className="mt-0.5 shrink-0">
              {s.done
                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                : <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${s.done ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                {s.id}. {s.label}
              </p>
              {!s.done && <p className="mt-0.5 text-xs text-slate-500">{s.detail}</p>}
              {!s.done && s.link && (
                <a href={s.link.href} target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400">
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
        <div className="mt-1 flex gap-2">
          {(['sandbox', 'production'] as const).map(e => (
            <button key={e} type="button" onClick={() => setEnv(e)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${env === e ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'}`}>
              {e === 'sandbox' ? '🧪 Sandbox (testes)' : '🚀 Produção'}
            </button>
          ))}
        </div>
        {env === 'sandbox' && (
          <p className="mt-1 text-[11px] text-yellow-600 dark:text-yellow-400">
            ⚠ Sandbox — cobranças não são reais. Troque para Produção antes de ir ao ar.
          </p>
        )}
      </div>

      {/* API Key */}
      <div>
        <label className={lb}>Chave de API Asaas</label>
        <div className="relative mt-1">
          <input
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={env === 'sandbox' ? '$aact_YTU5YTE0M2M...' : '$aact_prod_...'}
            className={`${fi} pr-9`}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {show ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              )}
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Cole aqui a chave gerada no Asaas. Ela fica somente no servidor (.env.local / Vercel secrets).</p>
      </div>

      {/* Webhook URL */}
      <CopyField label="URL do Webhook (cole no Asaas)" value={webhookUrl} />

      {/* Webhook Token */}
      <div>
        <label className={lb}>Token secreto do Webhook</label>
        <input
          type="text"
          value={webhookToken}
          onChange={e => setWebhookToken(e.target.value)}
          placeholder="Ex: hexxa_wh_2026_alguma_string_segura"
          className={`mt-1 ${fi}`}
        />
        <p className="mt-1 text-[11px] text-slate-400">Configure o mesmo token aqui e no campo "Token" do webhook no Asaas para autenticar as notificações.</p>
      </div>

      {!allDone && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Adicione <code className="font-mono">ASAAS_API_KEY</code>, <code className="font-mono">ASAAS_ENV</code> e <code className="font-mono">ASAAS_WEBHOOK_TOKEN</code> no <code className="font-mono">.env.local</code> (dev) ou nos <em>Environment Variables</em> do Vercel (produção) e reinicie o servidor.
          </p>
        </div>
      )}
    </div>
  );
}


export default function AdminIntegracoes() {
  const [saved, setSaved] = useState(false);

  function salvar() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Integrações</h1>
        <p className="text-sm text-slate-500">Configure os serviços externos conectados à plataforma</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        <Section
          icon={<CreditCard className="h-4 w-4" />}
          title="Asaas — cobrança recorrente"
          desc="Configure para cobrar os planos automaticamente via PIX, boleto ou cartão"
          fullWidth
        >
          <AsaasSetup />
        </Section>

        <Section icon={<Key className="h-4 w-4" />} title="Outras integrações" fullWidth>
          <div className="space-y-3">
            <SecretInput label="Chave API Focus NFe" value="focusnfe_live_••••••••••" placeholder="focusnfe_live_..." />
            <SecretInput label="Token Autentique (contratos)" placeholder="token..." />
            <SecretInput label="API Key cnpja.com (busca de empresas)" placeholder="uuid-key..." />
          </div>
        </Section>

      </div>

      <div className="flex justify-end">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors ${saved ? 'bg-green-500' : 'bg-brand-500 hover:bg-brand-600'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar integrações'}
        </button>
      </div>
    </div>
  );
}
