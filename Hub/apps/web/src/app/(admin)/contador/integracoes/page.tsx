import { CreditCard, Key, CheckCircle2, XCircle } from 'lucide-react';
import { Section } from '@/components/contador/AdminUI';
import { AsaasSetup } from './AsaasSetup';
import { getAsaasPlatformStatusAction } from './actions';

export default async function AdminIntegracoes() {
  const asaasStatus = await getAsaasPlatformStatusAction();
  const cnpjaConfigured = !!process.env.CNPJA_API_KEY;

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
          <AsaasSetup initial={asaasStatus} />
        </Section>

        <Section icon={<Key className="h-4 w-4" />} title="Outras integrações" desc="Status — configuradas por variável de ambiente, não editável aqui" fullWidth>
          {/*
            Removidos: "Focus NFe" (provedor terceirizado de NFSe cogitado
            como backup — nunca implementado, a emissão direta ao Emissor
            Nacional/gov.br já cobre isso, ver gov-nfse.adapter.ts) e
            "Autentique" (assinatura eletrônica — superado pelo DocuSeal,
            que é quem realmente assina hoje via ContractSignatureService).
            Os dois campos nunca salvavam nada de verdade.
          */}
          <div className="flex items-center justify-between rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-3.5">
            <div>
              <p className="text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">cnpja.com — busca de CNPJ</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">Configurada via <code className="font-mono bg-black/5 dark:bg-white/10 px-1 rounded">CNPJA_API_KEY</code> no ambiente (.env.local / Vercel).</p>
            </div>
            {cnpjaConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Configurada</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]"><XCircle className="h-4 w-4" /> Não configurada</span>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
