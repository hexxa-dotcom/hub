import { GlassCard } from '@/components/ui/GlassCard';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ContaAzulSetupForm } from './ContaAzulSetupForm';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Conta Azul | Hexx',
};

export default async function ContaAzulSetupPage() {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();
  
  // Buscar se já tem algo configurado
  const { data: credential } = await supabase
    .from('integration_credential')
    .select('secret_ref, active')
    .eq('company_id', ctx.companyId)
    .eq('provider', 'contaazul')
    .single();

  const isConnected = credential?.active || false;
  const clientId = credential?.secret_ref?.client_id || '';
  const clientSecret = credential?.secret_ref?.client_secret || '';

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#2684FF] text-white font-black text-2xl shadow-md">
            CA
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurar Conta Azul</h1>
            <p className="mt-1 text-ink-soft">
              Sincronize lançamentos financeiros automaticamente via OAuth2.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna Esquerda: Instruções */}
        <div className="space-y-6">
          <GlassCard title="Passo a Passo">
            <div className="p-6 space-y-6">
              <p className="text-sm text-ink-soft leading-relaxed">
                Para autorizar a conexão, você precisa criar um Aplicativo no Portal de Desenvolvedores da Conta Azul e obter o Client ID e Client Secret.
              </p>
              
              <ol className="relative border-l border-line/70 ml-3 space-y-8">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    1
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse o Portal de Desenvolvedores</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    Faça login no portal de Desenvolvedores da Conta Azul e crie uma nova aplicação.
                  </p>
                  <a href="https://developers.contaazul.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Portal Conta Azul <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    2
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Configurar URL de Callback</h3>
                  <p className="text-sm text-ink-soft">
                    Nas configurações do seu aplicativo na Conta Azul, você precisará preencher o campo de <strong>Redirect URI (Callback)</strong>. Cole exatamente esta URL:
                  </p>
                  <div className="mt-3 p-3 bg-surface border border-line rounded-xl font-mono text-xs text-ink select-all break-all shadow-inner">
                    https://app.hexx.com.br/api/integrations/contaazul/callback
                  </div>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    3
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Copie as Credenciais e Autorize</h3>
                  <p className="text-sm text-ink-soft">
                    Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong>, cole-os aqui ao lado e clique em Salvar. Você será redirecionado para a tela de login da Conta Azul para confirmar a permissão.
                  </p>
                </li>
              </ol>
            </div>
          </GlassCard>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="space-y-6">
          <ContaAzulSetupForm 
            initialClientId={clientId} 
            initialClientSecret={clientSecret} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
