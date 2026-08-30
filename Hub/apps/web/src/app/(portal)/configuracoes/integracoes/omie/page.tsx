import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { OmieSetupForm } from './OmieSetupForm';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export const metadata = {
  title: 'Configurar Integração Omie / OneFlow | Hexxa Hub',
};

export default async function OmieSetupPage() {
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
          eq(integrationCredential.provider, 'omie')
        )
      );
  });

  const isConnected = credential?.active || false;
  const secretData = credential?.secretRef as { appKey?: string; appSecret?: string } | undefined;
  
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#F48221] text-white font-serif font-black text-2xl shadow-md">
            OM
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">Configurar Omie / OneFlow</h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Sincronize recebimentos e despesas direto com a contabilidade do ERP.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Passo a Passo da Configuração</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed">
            Para o Hub se conectar ao sistema contábil, precisamos das credenciais (App Key e App Secret) do seu aplicativo na Omie.
          </p>
          
          <ol className="relative border-l border-black/10 dark:border-white/10 ml-3 space-y-8">
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                1
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Acesse as Configurações na Omie</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mb-2">
                Acesse o painel do aplicativo (Omie) da empresa que você deseja sincronizar.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                2
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Abra a área de Integração / API</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Clique no menu de Engrenagem (Configurações) no canto superior direito e depois em <strong>API - Integrações</strong> ou <strong>Chave de API</strong>.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                3
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">Copie as Chaves</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                Copie os valores correspondentes ao <strong>App Key</strong> e <strong>App Secret</strong> da integração e cole-os no formulário ao lado.
              </p>
            </li>
            <li className="pl-8">
              <span className="absolute -left-[15px] flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFFD6] text-[#2F4A3C] font-bold shadow-sm ring-4 ring-[#FEFDF3] dark:ring-[#121614] text-xs">
                4
              </span>
              <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-1">A mágica acontece em background</h3>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mb-2">
                A partir do momento em que as chaves são salvas, toda baixa no Hub envia automaticamente um espelho para a sua contabilidade! Sem importar arquivos CSV.
              </p>
            </li>
          </ol>
        </div>

        <div className="space-y-6">
          <OmieSetupForm 
            initialAppKey={secretData?.appKey || ''} 
            initialAppSecret={secretData?.appSecret || ''} 
            isConnected={isConnected} 
          />
        </div>
      </div>
    </div>
  );
}
