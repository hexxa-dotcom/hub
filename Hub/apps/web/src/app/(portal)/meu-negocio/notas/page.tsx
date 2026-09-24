import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, customer, eq } from '@hexxa/db';
import { nfseMode } from '@/lib/server/container';
import { getNfseConfig, estimateInvoiceTaxRate, isCertConfiguredForTenant, isFiscalComplete, listServiceProfiles } from '@/lib/server/fiscal';
import { regimeDaEmpresa, aliquotaDoFaturamento } from '@/lib/server/bussola';
import { notasDoMes, mesesComNotas } from '@/lib/server/notas';
import { SectionHero } from '@/components/ui/SectionHero';
import { NotasClient } from './NotasClient';

/**
 * NOTAS — o faturamento, nota por nota.
 *
 * Uma lista só, com o Emissor Nacional como fonte (ver lib/server/notas.ts):
 * as notas emitidas (o faturamento) e as recebidas (despesas com nota). Os
 * números do topo saem dessa lista — antes contavam só o que a Hexx emitiu e
 * diziam "R$ 0,00" ao lado de uma nota real.
 *
 * Emitir pela Hexx: para o Simples, só a partir de novembro/2026 (quando o
 * Emissor Nacional abre a emissão por API). Até lá a aba explica e manda para
 * o Emissor Nacional — a nota volta sozinha para cá.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notas · Hexx Digital' };

const LIBERA_SIMPLES = '2026-11-01';

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string }> }) {
  const ctx = await getTenantContext();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const { mes: mesPedido, aba } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesPedido ?? '') ? mesPedido! : hoje.slice(0, 7);

  const [notas, meses, regime, config, certOk, profiles, taxa, mode, clientes] = await Promise.all([
    notasDoMes(ctx, mes),
    mesesComNotas(ctx),
    regimeDaEmpresa(ctx),
    getNfseConfig(ctx).catch(() => null),
    isCertConfiguredForTenant(ctx).catch(() => false),
    listServiceProfiles(ctx).catch(() => []),
    aliquotaDoFaturamento(ctx).catch(() => ({ aliquota: 0, apurada: false })),
    nfseMode(ctx).catch(() => 'mock' as const),
    withTenant(ctx.companyId, (tx) =>
      tx.select({ id: customer.id, name: customer.name, document: customer.document, email: customer.email }).from(customer).where(eq(customer.companyId, ctx.companyId)),
    ),
  ]);

  const aliquota = taxa.aliquota;
  // Para o formulário de emissão, a estimativa por nota que considera o ISS do perfil.
  const aliquotaDaNota = config ? await estimateInvoiceTaxRate(ctx, config, profiles[0]?.aliquotaIss).catch(() => aliquota) : aliquota;
  const emissaoBloqueada = regime === 'SIMPLES_NACIONAL' && hoje < LIBERA_SIMPLES;
  clientes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title="Notas"
        subtitulo="O faturamento nota por nota, direto do Emissor Nacional"
        infoTitle="Sobre as Notas"
        infoDescription="Toda nota emitida ou recebida pelo CNPJ da empresa, venha do sistema que vier, chega pelo Emissor Nacional do governo — é ela que vale como faturamento. A sincronização roda todo dia de madrugada; você também pode sincronizar na hora."
      />
      <NotasClient
        mes={mes}
        meses={meses}
        notas={notas}
        aliquota={aliquota}
        aliquotaApurada={taxa.apurada}
        abaInicial={aba === 'emitir' ? 'emitir' : aba === 'recebidas' ? 'recebidas' : 'emitidas'}
        emissao={{
          bloqueada: emissaoBloqueada,
          mode,
          certOk,
          fiscalOk: isFiscalComplete(config),
          profiles,
          customers: clientes,
          taxRatePercent: aliquotaDaNota,
        }}
      />
    </div>
  );
}
