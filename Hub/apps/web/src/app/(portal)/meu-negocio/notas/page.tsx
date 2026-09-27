import { getTenantContext } from '@/lib/server/tenant';
import { withTenant } from '@hexxa/db';
import { nfseMode } from '@/lib/server/container';
import { getNfseConfig, estimateInvoiceTaxRate, isCertConfiguredForTenant, isFiscalComplete, listServiceProfiles } from '@/lib/server/fiscal';
import { regimeDaEmpresa, aliquotaDoFaturamento } from '@/lib/server/bussola';
import { notasDoMes, mesesComNotas } from '@/lib/server/notas';
import { SectionHero } from '@/components/ui/SectionHero';
import { NotasClient } from './NotasClient';
import { LIBERA_SIMPLES } from '@/lib/server/emissao';
import { listarAgendadas, notasPendentes } from '@/lib/server/emissao-agendada';
import { getDb, sql } from '@hexxa/db';

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


export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string }> }) {
  const ctx = await getTenantContext();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const { mes: mesPedido, aba } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesPedido ?? '') ? mesPedido! : hoje.slice(0, 7);

  const [notas, meses, regime, config, certOk, profiles, taxa, mode, clientes, agendadas, pendentes, prestador] = await Promise.all([
    notasDoMes(ctx, mes),
    mesesComNotas(ctx),
    regimeDaEmpresa(ctx),
    getNfseConfig(ctx).catch(() => null),
    isCertConfiguredForTenant(ctx).catch(() => false),
    listServiceProfiles(ctx).catch(() => []),
    aliquotaDoFaturamento(ctx).catch(() => ({ aliquota: 0, apurada: false })),
    nfseMode(ctx).catch(() => 'mock' as const),
    // Com telefone e endereço: a prévia da nota mostra, e o envio usa.
    withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`SELECT id::text, name, document, email, phone, endereco FROM customer WHERE company_id = ${ctx.companyId}`),
    ) as unknown as Promise<{ id: string; name: string; document: string | null; email: string | null; phone: string | null; endereco: Record<string, string> | null }[]>,
    listarAgendadas(ctx.companyId).catch(() => []),
    notasPendentes(ctx.companyId).catch(() => []),
    getDb()
      .execute(sql`
        SELECT legal_name AS nome, cnpj, city AS cidade, state AS uf, address_line1 AS logradouro, address_number AS numero
          FROM company WHERE id = ${ctx.companyId}`)
      .then((r) => r[0] as { nome: string; cnpj: string; cidade: string | null; uf: string | null; logradouro: string | null; numero: string | null } | undefined),
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
        abaInicial={aba === 'emitir' || aba === 'recebidas' || aba === 'agendadas' || aba === 'pendentes' ? aba : 'emitidas'}
        emissao={{
          bloqueada: emissaoBloqueada,
          mode,
          certOk,
          fiscalOk: isFiscalComplete(config),
          profiles,
          customers: clientes,
          taxRatePercent: aliquotaDaNota,
          agendadas,
          pendentes,
          prestador: prestador ?? null,
          liberaEm: emissaoBloqueada ? LIBERA_SIMPLES : null,
        }}
      />
    </div>
  );
}
