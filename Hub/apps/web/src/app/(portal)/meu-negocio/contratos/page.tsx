import { FileSignature } from 'lucide-react';
import { ContratosClient } from './ContratosClient';
import { makeContractSignatureService } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { listContractsAction, listRepassesAction } from './actions';
import { getContextualInsight } from '@/lib/server/ai-insight';
import { InsightCard } from '@/components/ui/InsightCard';
import { withTenant, eq } from '@hexxa/db';
import { property } from '@hexxa/db/schema';

export const dynamic = 'force-dynamic';

async function getSignatureRequests() {
  // DOCUSEAL_API_KEY ainda não configurada (ambiente local/novo) — estado
  // esperado, não um erro real: devolve lista vazia sem log de exceção.
  if (!process.env.DOCUSEAL_API_KEY) return [];
  try {
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    return await service.list(ctx);
  } catch (err) {
    console.error('[meu-negocio/contratos/page] falha ao listar assinaturas:', err);
    return [];
  }
}

async function hasAnyProperty(companyId: string): Promise<boolean> {
  const rows = await withTenant(companyId, async (tx) => {
    return tx.select({ id: property.id }).from(property).where(eq(property.companyId, companyId)).limit(1);
  });
  return rows.length > 0;
}

export default async function Page() {
  const ctx = await getTenantContext();
  const [initialDocs, initialContracts, hasProperties, initialRepasses] = await Promise.all([
    getSignatureRequests(),
    listContractsAction(),
    hasAnyProperty(ctx.companyId),
    listRepassesAction(),
  ]);

  const hoje = new Date();
  const in30Dias = new Date(hoje.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const semAssinatura = initialContracts.filter((c) => c.status === 'ATIVO' && !c.signingDate);
  const vencendoLogo = initialContracts.filter((c) => c.status === 'ATIVO' && c.endDate <= in30Dias);
  const insightContext = [
    `Tela: gestão de contratos (vínculos) de entrada (receita) e saída (despesa) de uma empresa.`,
    `Total de contratos ativos: ${initialContracts.filter((c) => c.status === 'ATIVO').length}.`,
    `Contratos ativos sem data de assinatura registrada: ${semAssinatura.length}${semAssinatura.length ? ` (ex.: ${semAssinatura.slice(0, 3).map((c) => c.title).join(', ')})` : ''}.`,
    `Contratos ativos vencendo nos próximos 30 dias: ${vencendoLogo.length}${vencendoLogo.length ? ` (ex.: ${vencendoLogo.slice(0, 3).map((c) => `${c.title} em ${c.endDate}`).join(', ')})` : ''}.`,
  ].join('\n');
  const insight = await getContextualInsight(ctx.companyId, 'meu-negocio/contratos', insightContext);

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FileSignature className="h-3.5 w-3.5" />
              Gestão Jurídica
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Gestão de Contratos de Serviços
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gerencie contratos de receita (clientes) e despesa (fornecedores), emissão de NFSe, cobranças Pix e assinaturas digitais.
          </p>
        </div>
      </header>

      <InsightCard pageKey="meu-negocio/contratos" insight={insight} />

      <ContratosClient
        initialDocs={initialDocs}
        initialContracts={initialContracts}
        companyType={ctx.companyType}
        hasProperties={hasProperties}
        initialRepasses={initialRepasses}
      />
    </div>
  );
}

