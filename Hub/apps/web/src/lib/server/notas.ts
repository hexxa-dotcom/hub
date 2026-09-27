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
  /**
   * Dá para cancelar por aqui: a nota da Hexx ainda não sincronizada (pelo id)
   * ou qualquer nota emitida pelo CNPJ (pela chave de acesso).
   */
  cancelar?: { id: string; protocolo: string; porChave?: boolean } | null;
  /** A nota de exemplo — só para ver o layout; não existe de verdade. */
  exemplo?: boolean;
  /**
   * Como a nota foi emitida: pela Hexx (manual, um clique, agendada, contrato)
   * ou fora dela ('EMISSOR' — no site do Emissor Nacional ou outro sistema).
   * null = emitida pela Hexx antes de guardarmos a origem.
   */
  emissao?: 'MANUAL' | 'UM_CLIQUE' | 'AGENDADA' | 'CONTRATO' | 'EMISSOR' | null;
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
  return notasDoPeriodo(ctx, { mes });
}

/**
 * As notas de um mês inteiro ou de um período qualquer (de/até, datas
 * 'AAAA-MM-DD', inclusive) — "os últimos 15 dias" atravessam o mês.
 */
export async function notasDoPeriodo(ctx: TenantContext, p: { mes: string } | { de: string; ate: string }): Promise<NotasDoMes> {
  const noGoverno =
    'mes' in p
      ? sql`to_char(data_emissao, 'YYYY-MM') = ${p.mes}`
      : sql`(data_emissao AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${p.de}::date AND ${p.ate}::date`;
  const naHexx =
    'mes' in p
      ? sql`to_char(coalesce(s.reference_month, s.created_at::date), 'YYYY-MM') = ${p.mes}`
      : sql`(s.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${p.de}::date AND ${p.ate}::date`;
  return withTenant(ctx.companyId, async (tx) => {
    const doGoverno = (await tx.execute(sql`
      SELECT chave_acesso, direction, numero_nfse, data_emissao, valor_servico, valor_liquido,
             prestador_nome, tomador_nome, descricao_servico, cancelado
        FROM nfse_distribuicao_doc
       WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE'
         AND ${noGoverno}
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
      SELECT s.id, s.nfse_number, s.provider_protocol, s.origem, s.amount, s.service_description, s.status::text AS status, s.created_at, c.name AS cliente
        FROM service_invoice s
        LEFT JOIN customer c ON c.id = s.customer_id
       WHERE s.company_id = ${ctx.companyId}
         AND ${naHexx}
       ORDER BY s.created_at DESC
    `)) as unknown as { id: string; nfse_number: string | null; provider_protocol: string | null; origem: NotaDoMes['emissao']; amount: string; service_description: string | null; status: string; created_at: Date; cliente: string | null }[];

    const [sync] = (await tx.execute(sql`
      SELECT max(created_at) AS em FROM nfse_distribuicao_doc WHERE company_id = ${ctx.companyId}
    `)) as unknown as { em: Date | null }[];

    // A nota que chega pelo Emissor Nacional casa com o registro da Hexx pela
    // chave (protocolo) ou pelo número; sem par, foi emitida fora da Hexx.
    const daHexxPorChave = new Map(daHexx.filter((s) => s.provider_protocol).map((s) => [s.provider_protocol!, s]));
    const daHexxPorNumero = new Map(daHexx.filter((s) => s.nfse_number && s.status !== 'ERROR').map((s) => [s.nfse_number!, s]));
    const emissaoDe = (d: (typeof doGoverno)[number]): NotaDoMes['emissao'] => {
      const par = daHexxPorChave.get(d.chave_acesso) ?? (d.numero_nfse ? daHexxPorNumero.get(d.numero_nfse) : undefined);
      return par ? (par.origem ?? null) : 'EMISSOR';
    };

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
      // Emitida pelo CNPJ e ainda válida: cancela-se pela chave, venha de onde vier.
      cancelar: d.direction !== 'RECEBIDA' && !d.cancelado ? { id: d.chave_acesso, protocolo: d.chave_acesso, porChave: true } : null,
      emissao: d.direction === 'RECEBIDA' ? undefined : emissaoDe(d),
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
        emissao: s.origem ?? null,
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
