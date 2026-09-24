import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { listarPropostas } from '@/lib/server/propostas';
import { origemPublica } from '@/lib/server/origem';
import { SectionHero } from '@/components/ui/SectionHero';
import { HubPropostas } from './HubPropostas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Propostas · Hexx Digital' };

export default async function Page({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const ctx = await getTenantContext();
  const [propostas, clientes, { cliente }] = await Promise.all([
    listarPropostas(ctx, await origemPublica()),
    withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`SELECT id, name AS nome, document AS documento, email FROM customer WHERE company_id = ${ctx.companyId} ORDER BY name`),
    ) as unknown as Promise<{ id: string; nome: string; documento: string | null; email: string | null }[]>,
    searchParams,
  ]);
  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title="Propostas"
        subtitulo="Do orçamento ao contrato, sem digitar de novo"
        infoTitle="Sobre as propostas"
        infoDescription="Monte a proposta, envie o link e acompanhe: você é avisado quando o cliente abre e quando aceita. Aceita, ela vira contrato com um clique — e o contrato assinado vira parcelas no financeiro."
      />
      <HubPropostas propostas={propostas} clientes={clientes} clienteInicial={cliente ?? null} />
    </div>
  );
}
