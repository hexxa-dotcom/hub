import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AsaasSetupForm } from './AsaasSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Configurar Integração Asaas | Hexxa Hub',
};

export default async function AsaasSetupPage() {
  const ctx = await getTenantContext();

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
          eq(integrationCredential.provider, 'asaas')
        )
      );
  });

  const isConnected = credential?.active || false;
  const secretData = credential?.secretRef as { access_token?: string } | undefined;
  const accessToken = secretData?.access_token || '';

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link 
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#0030B9] text-white font-serif font-black text-2xl shadow-(--elev-1)">
            AS
          </div>
          <div>
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">Configurar Asaas (Gateway)</h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft">
              Gere cobranças via PIX e Boleto e controle recebimentos de forma automática.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card level={1} className="p-6 sm:p-8 space-y-6">
          <h2 className="font-serif font-bold text-base text-ink">Passo a Passo da Configuração</h2>
          <p className="text-xs text-ink-soft leading-relaxed">
            Para permitir que o sistema emita PIX e boletos direto para a sua conta, cole a sua Chave de API do Asaas aqui.
          </p>
          
          <ol className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-8">
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">
                1
              </span>
              <h3 className="font-serif font-bold text-sm text-ink mb-1">Crie sua conta no Asaas</h3>
              <p className="text-xs text-ink-soft mb-2">
                Ainda não tem conta? Crie sua conta gratuita para emitir cobranças.
              </p>
              <a href="https://www.asaas.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime hover:underline">
                Criar conta Asaas <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">
                2
              </span>
              <h3 className="font-serif font-bold text-sm text-ink mb-1">Acesse suas Configurações de API</h3>
              <p className="text-xs text-ink-soft">
                No Asaas, vá em <strong>Minha Conta &gt; Integração (API)</strong> e clique em <strong>Gerar Chave de API</strong>.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">
                3
              </span>
              <h3 className="font-serif font-bold text-sm text-ink mb-1">Cole a chave de API</h3>
              <p className="text-xs text-ink-soft">
                Copie a chave gerada (Geralmente começa com <code>$aact_</code>) e cole no formulário ao lado.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime font-bold shadow-sm ring-4 ring-surface text-xs">
                4
              </span>
              <h3 className="font-serif font-bold text-sm text-ink mb-1">Ative a baixa automática (webhook)</h3>
              <p className="text-xs text-ink-soft mb-2">
                No Asaas, configure o webhook para <code>PAYMENT_CONFIRMED</code> e <code>PAYMENT_RECEIVED</code>:
              </p>
              <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-3 text-xs font-mono text-ink-soft space-y-1">
                <p>URL: <span className="text-ink font-semibold">https://app.hexx.com.br/api/webhooks/asaas</span></p>
              </div>
            </li>
          </ol>
        </Card>

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
