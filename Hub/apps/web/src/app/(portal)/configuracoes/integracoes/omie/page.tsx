import { GlassCard } from '@/components/ui/GlassCard';
import {  ArrowLeft, ArrowSquareOut  } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { OmieSetupForm } from './OmieSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Omie | Hexx',
};

export default async function OmieSetupPage() {
  const ctx = await getTenantContext();

  // Buscar se já tem algo configurado
  const [credential] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        secretRef: integrationCredential.secretRef,
        active: integrationCredential.active,
      })
      .from(integrationCredential)
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.provider, 'omie')
        )
      );
  });

  const isConnected = credential?.active || false;
  const secretData = credential?.secretRef as { app_key?: string, app_secret?: string } | undefined;
  const appKey = secretData?.app_key || '';
  const appSecret = secretData?.app_secret || '';

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#FF7D00] text-white font-black text-2xl shadow-md">
            OM
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurar Omie ERP</h1>
            <p className="mt-1 text-ink-soft">
              Sincronize faturamento, despesas e relatórios automaticamente.
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
                A integração com o Omie é direta e não requer redirecionamentos. Basta gerar suas credenciais (App Key e App Secret) dentro do sistema Omie e inseri-las aqui.
              </p>
              
              <ol className="relative border-l border-line/70 ml-3 space-y-8">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    1
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse o seu painel do Omie</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    Faça login na sua conta do Omie e acesse o aplicativo (empresa) que deseja integrar.
                  </p>
                  <a href="https://app.omie.com.br/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Abrir Omie <ArrowSquareOut className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    2
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse as Configurações do App</h3>
                  <p className="text-sm text-ink-soft">
                    Na tela inicial, clique na <strong>engrenagem</strong> no card do seu aplicativo e selecione <strong>"Resumo do App"</strong> (ou vá direto pelo Portal do Desenvolvedor em Aplicativos).
                  </p>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    3
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Copie as Credenciais</h3>
                  <p className="text-sm text-ink-soft">
                    Role a página até o final até encontrar a seção <strong>"Chave de Integração (API)"</strong>. Copie o <strong>App Key</strong> e o <strong>App Secret</strong> gerados pelo Omie e cole no formulário ao lado.
                  </p>
                </li>
              </ol>
            </div>
          </GlassCard>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="space-y-6">
          <OmieSetupForm 
            initialAppKey={appKey} 
            initialAppSecret={appSecret} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
