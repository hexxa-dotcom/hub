import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * AS NOTAS DO MÊS — uma lista só.
 *
 * A fonte é o Emissor Nacional: toda nota emitida ou recebida pelo CNPJ da
 * empresa chega por lá, venha do sistema que vier (é o faturamento, ver a
 * memória "faturamento via Emissor Nacional"). As notas emitidas pela Hexx
 * também chegam por lá; enquanto não chegam (a sincronização roda de
 * madrugada), aparecem pelo registro da própria Hexx — e não duplicam: o
 * número da nota casa as duas.
 *
 * Tentativas de emissão que deram erro ficam à parte, para descartar.
 */

export interface NotaDoMes {
  id: string;
  origem: 'EMISSOR_NACIONAL' | 'HEXX';
  numero: string | null;
  data: string | null; // ISO
  /** Com quem: o tomador (emitida) ou o prestador (recebida). */
  parte: string | null;
  descricao: string | null;
  valor: number;
  cancelada: boolean;
  /** Onde abrir a DANFSe dentro do Hub. */
  danfse: string | null;
  processando?: boolean;
  /** Nota emitida pela Hexx: dá para cancelar por aqui. */
  cancelar?: { id: string; protocolo: string } | null;
}

export interface TentativaComErro {
  id: string;
  valor: number;
  descricao: string | null;
  cliente: string | null;
  em: string;
}

export interface NotasDoMes {
  emitidas: NotaDoMes[];
  recebidas: NotaDoMes[];
  comErro: TentativaComErro[];
  ultimaSincronizacao: string | null;
}

export async function notasDoMes(ctx: TenantContext, mes: string): Promise<NotasDoMes> {
  return withTenant(ctx.companyId, async (tx) => {
    const doGoverno = (await tx.execute(sql`
      SELECT chave_acesso, direction, numero_nfse, data_emissao, valor_servico, valor_liquido,
             prestador_nome, tomador_nome, descricao_servico, cancelado
        FROM nfse_distribuicao_doc
       WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE'
         AND to_char(data_emissao, 'YYYY-MM') = ${mes}
       ORDER BY data_emissao DESC
    `)) as unknown as {
      chave_acesso: string;
      direction: 'EMITIDA' | 'RECEBIDA' | null;
      numero_nfse: string | null;
      data_emissao: string | null;
      valor_servico: string | null;
      valor_liquido: string | null;
      prestador_nome: string | null;
      tomador_nome: string | null;
      descricao_servico: string | null;
      cancelado: boolean;
    }[];

    const daHexx = (await tx.execute(sql`
      SELECT s.id, s.nfse_number, s.provider_protocol, s.amount, s.service_description, s.status::text AS status, s.created_at, c.name AS cliente
        FROM service_invoice s
        LEFT JOIN customer c ON c.id = s.customer_id
       WHERE s.company_id = ${ctx.companyId}
         AND to_char(coalesce(s.reference_month, s.created_at::date), 'YYYY-MM') = ${mes}
       ORDER BY s.created_at DESC
    `)) as unknown as { id: string; nfse_number: string | null; provider_protocol: string | null; amount: string; service_description: string | null; status: string; created_at: Date; cliente: string | null }[];

    const [sync] = (await tx.execute(sql`
      SELECT max(created_at) AS em FROM nfse_distribuicao_doc WHERE company_id = ${ctx.companyId}
    `)) as unknown as { em: Date | null }[];

    const doc = (d: (typeof doGoverno)[number]): NotaDoMes => ({
      id: d.chave_acesso,
      origem: 'EMISSOR_NACIONAL',
      numero: d.numero_nfse,
      data: d.data_emissao ? new Date(d.data_emissao).toISOString() : null,
      parte: d.direction === 'RECEBIDA' ? d.prestador_nome : d.tomador_nome,
      descricao: d.descricao_servico,
      // Faturamento é o valor BRUTO do serviço, não o líquido de retenções.
      valor: Number(d.valor_servico ?? d.valor_liquido ?? 0),
      cancelada: d.cancelado,
      danfse: `/api/nfse/dfe/${d.chave_acesso}`,
    });

    const numerosDoGoverno = new Set(doGoverno.filter((d) => d.direction !== 'RECEBIDA').map((d) => d.numero_nfse).filter(Boolean));
    const aindaNaoChegaram: NotaDoMes[] = daHexx
      .filter((s) => (s.status === 'ISSUED' || s.status === 'PROCESSING') && !(s.nfse_number && numerosDoGoverno.has(s.nfse_number)))
      .map((s) => ({
        id: s.id,
        origem: 'HEXX',
        numero: s.nfse_number,
        data: new Date(s.created_at).toISOString(),
        parte: s.cliente,
        descricao: s.service_description,
        valor: Number(s.amount),
        cancelada: false,
        danfse: s.status === 'ISSUED' ? `/api/nfse/${s.id}/pdf` : null,
        processando: s.status === 'PROCESSING',
        cancelar: s.status === 'ISSUED' && s.provider_protocol ? { id: s.id, protocolo: s.provider_protocol } : null,
      }));

    return {
      emitidas: [...doGoverno.filter((d) => d.direction !== 'RECEBIDA').map(doc), ...aindaNaoChegaram],
      recebidas: doGoverno.filter((d) => d.direction === 'RECEBIDA').map(doc),
      comErro: daHexx
        .filter((s) => s.status === 'ERROR')
        .map((s) => ({ id: s.id, valor: Number(s.amount), descricao: s.service_description, cliente: s.cliente, em: new Date(s.created_at).toISOString() })),
      ultimaSincronizacao: sync?.em ? new Date(sync.em).toISOString() : null,
    };
  });
}

/** Meses com alguma nota (para o seletor), do mais recente para trás, sempre incluindo o atual. */
export async function mesesComNotas(ctx: TenantContext): Promise<string[]> {
  const linhas = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT DISTINCT to_char(data_emissao, 'YYYY-MM') AS mes FROM nfse_distribuicao_doc
       WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND data_emissao IS NOT NULL
      UNION
      SELECT DISTINCT to_char(coalesce(reference_month, created_at::date), 'YYYY-MM') FROM service_invoice WHERE company_id = ${ctx.companyId}
    `),
  )) as unknown as { mes: string }[];
  const atual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  return Array.from(new Set([atual, ...linhas.map((l) => l.mes)])).sort().reverse();
}
