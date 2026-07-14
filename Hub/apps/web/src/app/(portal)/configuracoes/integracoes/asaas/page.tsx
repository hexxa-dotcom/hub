import { GlassCard } from '@/components/ui/GlassCard';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AsaasSetupForm } from './AsaasSetupForm';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Asaas | Hexx',
};

export default async function AsaasSetupPage() {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();
  
  const { data: credential } = await supabase
    .from('integration_credential')
    .select('secret_ref, active')
    .eq('company_id', ctx.companyId)
    .eq('provider', 'asaas')
    .single();

  const isConnected = credential?.active || false;
  const accessToken = credential?.secret_ref?.access_token || '';

  return (
    <div className="mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4">
        <Link 
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0030B9] text-white font-black text-2xl shadow-md">
            AS
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurar Asaas (Gateway)</h1>
            <p className="mt-1 text-ink-soft">
              Gere cobranças via PIX e Boleto e controle recebimentos de forma automática.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <GlassCard title="Passo a Passo">
            <div className="p-6 space-y-6">
              <p className="text-sm text-ink-soft leading-relaxed">
                Para permitir que o sistema emita PIX e boletos direto para a sua conta, você precisa colar a sua Chave de API do Asaas aqui.
              </p>
              
              <ol className="relative border-l border-line/70 ml-3 space-y-8">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    1
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Crie sua conta no Asaas</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    Ainda não tem conta? Crie sua conta gratuita pelo nosso link de parceria para aproveitar vantagens.
                  </p>
                  <a href="https://www.asaas.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Criar conta Asaas <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    2
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse suas Configurações de API</h3>
                  <p className="text-sm text-ink-soft">
                    No Asaas, vá em <strong>Minha Conta <span className="mx-1">&gt;</span> Integração (API)</strong> e clique em <strong>Gerar Chave de API</strong>.
                  </p>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    3
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Cole a chave de API</h3>
                  <p className="text-sm text-ink-soft">
                    Copie a chave gerada (Geralmente começa com <code>$aact_</code>) e cole no formulário ao lado para conectar.
                  </p>
                </li>
              </ol>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <AsaasSetupForm 
            initialToken={accessToken} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
