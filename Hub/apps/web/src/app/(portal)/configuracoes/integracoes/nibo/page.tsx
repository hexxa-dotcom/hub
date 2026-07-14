import { GlassCard } from '@/components/ui/GlassCard';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NiboSetupForm } from './NiboSetupForm';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Nibo | Hexx',
};

export default async function NiboSetupPage() {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();
  
  // Buscar se já tem algo configurado
  const { data: credential } = await supabase
    .from('integration_credential')
    .select('secret_ref, active')
    .eq('company_id', ctx.companyId)
    .eq('provider', 'nibo')
    .single();

  const isConnected = credential?.active || false;
  const apiToken = credential?.secret_ref?.api_token || '';

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#00C389] text-white font-black text-2xl shadow-md">
            NB
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurar Nibo</h1>
            <p className="mt-1 text-ink-soft">
              Integração completa de contas a pagar e receber do Nibo.
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
                A integração com o Nibo é simples e direta via <strong>API Token</strong>. Não é necessário nenhum redirecionamento ou callback.
              </p>
              
              <ol className="relative border-l border-line/70 ml-3 space-y-8">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    1
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse sua conta no Nibo</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    Faça login, vá até o menu <strong>Minhas Empresas</strong>, selecione <strong>Mais Opções</strong> e depois clique em <strong>Configurações</strong>.
                  </p>
                  <a href="https://app.nibo.com.br" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Acessar Nibo <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    2
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Gere o Token de Acesso</h3>
                  <p className="text-sm text-ink-soft">
                    Dentro das Configurações, acesse a aba <strong>API</strong> e clique no botão <strong>+ Gerar token de acesso</strong>. Preencha a descrição (ex: Integração Hexx) e salve.
                  </p>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    3
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Copie o Token</h3>
                  <p className="text-sm text-ink-soft">
                    Copie a string longa gerada pelo Nibo e cole no formulário ao lado para validar a sua conexão instantaneamente.
                  </p>
                </li>
              </ol>
            </div>
          </GlassCard>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="space-y-6">
          <NiboSetupForm 
            initialApiToken={apiToken} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
