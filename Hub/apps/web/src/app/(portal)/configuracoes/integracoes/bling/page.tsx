import { GlassCard } from '@/components/ui/GlassCard';
import {  ArrowLeft, ArrowSquareOut  } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { BlingSetupForm } from './BlingSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Bling | Hexx',
};

export default async function BlingSetupPage() {
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
          eq(integrationCredential.provider, 'bling')
        )
      );
  });

  const isConnected = credential?.active || false;
  const secretData = credential?.secretRef as { client_id?: string, client_secret?: string } | undefined;
  const clientId = secretData?.client_id || '';
  const clientSecret = secretData?.client_secret || '';

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#2C3E50] text-white font-black text-2xl shadow-md">
            BL
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurar Bling ERP</h1>
            <p className="mt-1 text-ink-soft">
              Sincronize contas a pagar, contas a receber e clientes automaticamente.
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
                Para autorizar a conexão com a sua conta do Bling, você precisa criar um Aplicativo dentro do seu painel e obter as credenciais de segurança (Client ID e Client Secret).
              </p>
              
              <ol className="relative border-l border-line/70 ml-3 space-y-8">
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    1
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Acesse o seu painel do Bling</h3>
                  <p className="text-sm text-ink-soft mb-2">
                    Faça login no Bling e vá em <strong>Preferências <span className="mx-1">&gt;</span> Sistemas <span className="mx-1">&gt;</span> Aplicativos <span className="mx-1">&gt;</span> Meus Aplicativos</strong>.
                  </p>
                  <a href="https://www.bling.com.br/b/aplicativos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Abrir Bling <ArrowSquareOut className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    2
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Adicione um Novo Aplicativo</h3>
                  <p className="text-sm text-ink-soft">
                    Clique em "Adicionar Aplicativo". No formulário, preencha o nome do app como <strong>Integração Hexx</strong> e, no campo <strong>URL de Redirecionamento (Callback)</strong>, cole exatamente a URL abaixo:
                  </p>
                  <div className="mt-3 p-3 bg-surface border border-line rounded-xl font-mono text-xs text-ink select-all break-all shadow-inner">
                    https://app.hexx.com.br/api/integrations/bling/callback
                  </div>
                </li>
                <li className="pl-8">
                  <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold shadow-sm ring-4 ring-surface-card">
                    3
                  </span>
                  <h3 className="font-semibold text-ink text-base mb-1">Copie as Credenciais</h3>
                  <p className="text-sm text-ink-soft">
                    Após salvar o aplicativo no Bling, copie as chaves geradas e cole no formulário ao lado.
                  </p>
                </li>
              </ol>
            </div>
          </GlassCard>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="space-y-6">
          <BlingSetupForm 
            initialClientId={clientId} 
            initialClientSecret={clientSecret} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
