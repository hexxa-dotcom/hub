import { Plug, CheckCircle2, XCircle, ArrowLeftRight, ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { IntegrationStatusBlock } from './IntegrationStatusBlock';

export const metadata = {
  title: 'Integrações Financeiras | Hexxa Hub',
};

const BASE_ERPS = [
  {
    id: 'asaas',
    name: 'Asaas',
    sub: 'Gateway de Pagamentos & Pix',
    desc: 'Integração para emissão de cobranças via PIX e Boleto para seus clientes com baixa automática.',
    color: '#0030B9',
    logo: 'AS',
  },
];

export default async function IntegracoesPage() {
  const ctx = await getTenantContext();

  // Buscar integrações ativas
  const credentials = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        provider: integrationCredential.provider,
        active: integrationCredential.active,
      })
      .from(integrationCredential)
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.active, true)
        )
      );
  });

  const connectedMap = new Map((credentials || []).map((c: any) => [c.provider, c]));

  const ERPS = BASE_ERPS.map(erp => ({
    ...erp,
    connected: connectedMap.has(erp.id),
  }));

  return (
    <div className="mx-auto w-full space-y-8 animate-in fade-in">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Plug className="h-3.5 w-3.5" />
              Integrações
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Integrações
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-2xl">
            Conecte o gateway de pagamento e o assistente de IA pra centralizar cobranças e consultas financeiras sem sair do Hub.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/suporte" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all shadow-sm">
            Solicitar nova conexão <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Assistente de IA (MCP) */}
      <Link
        href={'/configuracoes/integracoes/mcp' as Route}
        className="block rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] p-6 shadow-sm relative overflow-hidden group hover:scale-[1.005] transition-transform"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFFFAE]/15 text-[#DFFFAE]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base text-[#FEFDF3]">Assistente de IA & API</h3>
            <p className="text-xs text-[#DFFFAE]/70 mt-0.5">
              Conecte o Claude, ChatGPT ou um sistema externo pra consultar — e, com um token de escrita, lançar — dados financeiros por fora do Hub.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#DFFFAE] shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {/* Grid de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {ERPS.map((erp) => (
          <div key={erp.id} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-[#1E3328]/30 transition-all">
            {/* Decoração superior */}
            <div className="absolute top-0 left-0 right-0 h-1.5 opacity-80" style={{ backgroundColor: erp.color }} />
            
            <div>
              <div className="flex items-start justify-between mb-4 mt-1">
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-serif font-black text-xl shadow-md transition-transform group-hover:scale-105"
                    style={{ backgroundColor: erp.color }}
                  >
                    {erp.logo}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] leading-tight">{erp.name}</h3>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">{erp.sub}</p>
                    {erp.connected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E6A61] dark:text-[#A8A49C] mt-1">
                        <XCircle className="h-3.5 w-3.5" /> Não configurado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed mb-6">
                {erp.desc}
              </p>
            </div>

            {erp.connected ? (
              <IntegrationStatusBlock providerId={erp.id} />
            ) : (
              <div className="pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Via API Segura</span>
                <Link href={`/configuracoes/integracoes/${erp.id}` as Route} className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-1.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
                  Configurar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Seção Explicativa / Como funciona */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2 mb-2">
              <ArrowLeftRight className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              Como Funciona a Integração
            </h3>
            <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mb-4 leading-relaxed">
              Conectar seu sistema aqui armazena suas credenciais com criptografia ponta a ponta (via OAuth2 ou tokens seguros de API). A comunicação é feita de forma estritamente segura para leitura de faturamento e baixa de conciliação.
            </p>
            <ul className="text-xs sm:text-sm space-y-2 text-[#6E6A61] dark:text-[#A8A49C]">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Credenciais armazenadas com segurança via Vault</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Webhook de baixa automática de pagamentos Asaas</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Assistente de IA e API externa com token revogável e escopo leitura/escrita</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

