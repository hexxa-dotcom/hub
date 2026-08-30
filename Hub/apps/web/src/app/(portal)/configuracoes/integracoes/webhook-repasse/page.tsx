import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { WebhookRepasseSetupForm } from './WebhookRepasseSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Faturamento do SaaS do Cliente | Hexxa Hub',
};

export default async function WebhookRepassePage() {
  const ctx = await getTenantContext();

  const [credential] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ active: integrationCredential.active })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, ctx.companyId), eq(integrationCredential.provider, 'webhook-repasse')));
  });

  const isConnected = credential?.active ?? false;
  const webhookUrl = `https://app.hexx.com.br/api/webhooks/revenue-saas/${ctx.companyId}`;

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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#7C3AED] text-white font-serif font-black text-2xl shadow-md">
            WR
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
              Faturamento do SaaS do Cliente
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Receba o faturamento do sistema que você usa (ex.: SaaS de telemedicina) em tempo real e gere automaticamente o valor a pagar de cada prestador.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Como funciona</h2>
          <ol className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-8">
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">1</span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Gere a URL e o segredo do webhook</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">O botão ao lado gera uma URL única desta empresa e um segredo — copie os dois agora, o segredo só aparece uma vez.</p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">2</span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Configure no painel do seu SaaS</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Cole a URL como destino do webhook de faturamento/transações, e o segredo no header <code>x-webhook-secret</code> (ou onde o painel do seu SaaS pedir um segredo compartilhado).</p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">3</span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Vincule médicos/prestadores pelos contratos</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Em <strong>Meu Negócio → Contratos</strong>, crie o contrato de cada prestador (Prestação de Serviço, direção "Minha empresa contrata") e preencha o ID dele no seu SaaS + o % de repasse. Assim que o contrato for assinado, o repasse passa a ser automático.
              </p>
            </li>
          </ol>
          <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] italic">
            Formato do payload ainda não confirmado com seu fornecedor de SaaS — os primeiros eventos podem precisar de um ajuste fino conosco.
          </p>
        </div>

        <div className="space-y-6">
          <WebhookRepasseSetupForm isConnected={isConnected} webhookUrl={webhookUrl} />
        </div>
      </div>
    </div>
  );
}
