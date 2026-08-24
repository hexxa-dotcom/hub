import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AsaasSetupForm } from './AsaasSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

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
    <div className="mx-auto w-full space-y-8 animate-in fade-in">
      <header className="flex flex-col gap-4">
        <Link 
          href="/configuracoes/integracoes"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#0030B9] text-white font-serif font-black text-2xl shadow-md">
            AS
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">Configurar Asaas (Gateway)</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Gere cobranças via PIX e Boleto e controle recebimentos de forma automática.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Passo a Passo da Configuração</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed">
            Para permitir que o sistema emita PIX e boletos direto para a sua conta, cole a sua Chave de API do Asaas aqui.
          </p>
          
          <ol className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-8">
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                1
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Crie sua conta no Asaas</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mb-2">
                Ainda não tem conta? Crie sua conta gratuita para emitir cobranças.
              </p>
              <a href="https://www.asaas.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">
                Criar conta Asaas <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                2
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Acesse suas Configurações de API</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                No Asaas, vá em <strong>Minha Conta &gt; Integração (API)</strong> e clique em <strong>Gerar Chave de API</strong>.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                3
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Cole a chave de API</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Copie a chave gerada (Geralmente começa com <code>$aact_</code>) e cole no formulário ao lado.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                4
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Ative a baixa automática (webhook)</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mb-2">
                No Asaas, configure o webhook para <code>PAYMENT_CONFIRMED</code> e <code>PAYMENT_RECEIVED</code>:
              </p>
              <div className="rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/10 dark:border-white/10 p-3 text-xs font-mono text-[#6E6A61] dark:text-[#A8A49C] space-y-1">
                <p>URL: <span className="text-[#231F20] dark:text-[#FEFDF3]">https://app.hexx.com.br/api/webhooks/asaas</span></p>
              </div>
            </li>
          </ol>
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

