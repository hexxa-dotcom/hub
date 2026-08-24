'use client';

import { useState } from 'react';
import { Save, CreditCard, Key, CheckCircle2, Circle, ExternalLink, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Section, Toggle, SecretInput, CopyField, lb, fi } from '@/components/contador/AdminUI';

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
    ? `${window.location.origin}/api/webhooks/asaas`
    : 'https://seu-dominio.com/api/webhooks/asaas';

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
          <li key={s.id} className={`flex gap-3 rounded-2xl p-3.5 border ${s.done ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614]'}`}>
            <span className="mt-0.5 shrink-0">
              {s.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <Circle className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C]" />}
            </span>
            <div className="min-w-0">
              <p className={`text-xs sm:text-sm font-bold ${s.done ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-[#231F20] dark:text-[#FEFDF3]'}`}>
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
        <label className={lb}>Chave de API Asaas</label>
        <div className="relative mt-1.5">
          <input
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={env === 'sandbox' ? '$aact_YTU5YTE0M2M...' : '$aact_prod_...'}
            className={`${fi} pr-10`}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#FEFDF3]">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Cole aqui a chave gerada no Asaas. Ela fica somente no servidor (.env.local / Vercel secrets).</p>
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
          className={`mt-1.5 ${fi}`}
        />
        <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Configure o mesmo token aqui e no campo "Token" do webhook no Asaas para autenticar as notificações.</p>
      </div>

      {!allDone && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Adicione <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">ASAAS_API_KEY</code>, <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">ASAAS_ENV</code> e <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">ASAAS_WEBHOOK_TOKEN</code> no <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">.env.local</code> (dev) ou nos <em>Environment Variables</em> do Vercel (produção) e reinicie o servidor.
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
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Integrações</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Configure os serviços externos conectados à plataforma</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          icon={<CreditCard className="h-4 w-4" />}
          title="Asaas — cobrança recorrente"
          desc="Configure para cobrar os planos automaticamente via PIX, boleto ou cartão"
          fullWidth
        >
          <AsaasSetup />
        </Section>

        <Section icon={<Key className="h-4 w-4" />} title="Outras integrações" fullWidth>
          <div className="space-y-3.5">
            <SecretInput label="Chave API Focus NFe" value="focusnfe_live_••••••••••" placeholder="focusnfe_live_..." />
            <SecretInput label="Token Autentique (contratos)" placeholder="token..." />
            <SecretInput label="API Key cnpja.com (busca de empresas)" placeholder="uuid-key..." />
          </div>
        </Section>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-white transition-all shadow-xs ${saved ? 'bg-emerald-600' : 'bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE]'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar integrações'}
        </button>
      </div>
    </div>
  );
}

