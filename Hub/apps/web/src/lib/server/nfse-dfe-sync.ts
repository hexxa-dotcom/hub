import 'server-only';
import type { TenantContext } from '@hexxa/core';
import { fetchDistribuicaoLote } from '@hexxa/integrations';
import { withTenant, sql } from '@hexxa/db';
import { getNfseConfig, getCertForTenant } from './fiscal';

/**
 * Sincroniza com a Distribuição de DF-e do Sistema Nacional NFS-e (ADN) —
 * ver packages/integrations/src/nfse/dfe-distribuicao.adapter.ts pro porquê
 * disso existir: dá pra ver o VALOR de toda nota emitida OU recebida pelo
 * CNPJ da empresa (não importa o sistema que emitiu — inclusive sistemas
 * próprios de município como o de Navegantes) sem precisar emitir pela Hexx.
 */

const EVENTOS_CANCELAMENTO = new Set([
  'CANCELAMENTO',
  'CANCELAMENTO_POR_SUBSTITUICAO',
  'CANCELAMENTO_POR_OFICIO',
  'CANCELAMENTO_DEFERIDO_ANALISE_FISCAL',
]);

/** Máximo de páginas (lotes) buscadas numa única chamada de sync — evita uma requisição infinita/gigante; o usuário só clica sincronizar de novo se sobrar. */
const MAX_PAGINAS_POR_SYNC = 20;

export interface SyncDfeResult {
  documentosNovos: number;
  eventosNovos: number;
  ultNsu: number;
  temMaisParaSincronizar: boolean;
  erro?: string;
}

export async function syncDistribuicaoDfe(ctx: TenantContext): Promise<SyncDfeResult> {
  const cfg = await getNfseConfig(ctx);
  if (!cfg?.cnpj) {
    return { documentosNovos: 0, eventosNovos: 0, ultNsu: 0, temMaisParaSincronizar: false, erro: 'CNPJ não cadastrado no Cadastro Fiscal.' };
  }
  // O CNPJ do cadastro fiscal tem de ser o da empresa. Se for de outra
  // pessoa, as notas dela entrariam aqui como faturamento desta empresa.
  const [empresa] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`SELECT cnpj FROM company WHERE id = ${ctx.companyId}`),
  )) as unknown as { cnpj: string | null }[];
  const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
  if (soDigitos(empresa?.cnpj) !== soDigitos(cfg.cnpj)) {
    return {
      documentosNovos: 0, eventosNovos: 0, ultNsu: cfg.ultNsuDistribuicao, temMaisParaSincronizar: false,
      erro: `O CNPJ do Cadastro Fiscal (${cfg.cnpj}) não é o desta empresa (${empresa?.cnpj ?? '—'}). Corrija antes de sincronizar.`,
    };
  }

  const cert = await getCertForTenant(ctx);
  if (!cert) {
    return { documentosNovos: 0, eventosNovos: 0, ultNsu: 0, temMaisParaSincronizar: false, erro: 'Certificado A1 não configurado.' };
  }

  let ultNsu = cfg.ultNsuDistribuicao;
  let documentosNovos = 0;
  let eventosNovos = 0;
  let temMaisParaSincronizar = false;

  for (let pagina = 0; pagina < MAX_PAGINAS_POR_SYNC; pagina++) {
    const lote = await fetchDistribuicaoLote(cert, cfg.ambiente, cfg.cnpj, ultNsu);

    if (lote.statusProcessamento === 'REJEICAO') {
      return { documentosNovos, eventosNovos, ultNsu, temMaisParaSincronizar: false, erro: lote.erros.join('; ') || 'Rejeição na consulta.' };
    }

    if (lote.notas.length === 0 && lote.eventos.length === 0) {
      break;
    }

    await withTenant(ctx.companyId, async (tx) => {
      for (const nota of lote.notas) {
        await tx.execute(sql`
          INSERT INTO nfse_distribuicao_doc (
            company_id, nsu, chave_acesso, tipo_documento, direction, numero_nfse,
            municipio_emissao, data_emissao, valor_servico, valor_liquido, valor_iss,
            prestador_cnpj, prestador_nome, tomador_documento, tomador_nome,
            descricao_servico, item_lista_servico
          ) VALUES (
            ${ctx.companyId}, ${nota.nsu}, ${nota.chaveAcesso}, 'NFSE', ${nota.direction},
            ${nota.numeroNfse || null}, ${nota.municipioEmissao || null},
            ${nota.dataEmissao || null}, ${nota.valorServico ?? null}, ${nota.valorLiquido ?? null},
            ${nota.valorIss ?? null}, ${nota.prestadorCnpj || null}, ${nota.prestadorNome || null},
            ${nota.tomadorDocumento || null}, ${nota.tomadorNome || null},
            ${nota.descricaoServico || null}, ${nota.itemListaServico || null}
          )
          ON CONFLICT (company_id, nsu) DO NOTHING
        `);

        // Nota EMITIDA (empresa é a prestadora) entra em contas a receber, do
        // mesmo jeito que uma nota emitida pelo próprio Hub entraria (mesmo
        // type/status) — só muda a origem (source) e o external_id, que usa
        // a chave de acesso (global e única) como chave de idempotência,
        // já que não existe um service_invoice local pra essas notas. Isso
        // é o que faz o valor contar no RBT12/Fator R (Simples Nacional) e
        // no faturamento real do módulo Financeiro.
        if (nota.direction === 'EMITIDA') {
          // Faturamento é o valor BRUTO do serviço — é sobre ele que o Simples
          // incide. O líquido desconta retenções e subestimaria o RBT12.
          const valor = nota.valorServico ?? nota.valorLiquido ?? 0;
          // A data vem com o fuso de quem emitiu (`2026-09-30T23:10:00-03:00`).
          // Ler os dígitos direto evita que o servidor em UTC empurre uma nota
          // do último dia do mês para o mês seguinte.
          const dueDate = nota.dataEmissao?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
          const referenceMonth = `${dueDate.slice(0, 7)}-01`;
          const descricao = `NFS-e nº ${nota.numeroNfse ?? '—'} — ${nota.tomadorNome ?? 'Cliente'} (sincronizada do Emissor Nacional)`;

          await tx.execute(sql`
            INSERT INTO financial_entry (company_id, type, status, description, amount, due_date, reference_month, source, external_id)
            VALUES (${ctx.companyId}, 'RECEIVABLE', 'PENDING', ${descricao}, ${valor}, ${dueDate}, ${referenceMonth}, 'DFE_SYNC', ${nota.chaveAcesso})
            ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING
          `);
        }
      }

      for (const evento of lote.eventos) {
        await tx.execute(sql`
          INSERT INTO nfse_distribuicao_doc (company_id, nsu, chave_acesso, tipo_documento, tipo_evento, data_hora_geracao)
          VALUES (${ctx.companyId}, ${evento.nsu}, ${evento.chaveAcesso}, 'EVENTO', ${evento.tipoEvento}, ${evento.dataHoraGeracao || null})
          ON CONFLICT (company_id, nsu) DO NOTHING
        `);

        if (EVENTOS_CANCELAMENTO.has(evento.tipoEvento)) {
          await tx.execute(sql`
            UPDATE nfse_distribuicao_doc SET cancelado = true
            WHERE company_id = ${ctx.companyId} AND chave_acesso = ${evento.chaveAcesso} AND tipo_documento = 'NFSE'
          `);
          await tx.execute(sql`
            UPDATE financial_entry SET status = 'CANCELED'
            WHERE company_id = ${ctx.companyId} AND source = 'DFE_SYNC' AND external_id = ${evento.chaveAcesso} AND status != 'CANCELED'
          `);
        }
      }

      await tx.execute(sql`
        UPDATE nfse_config SET ult_nsu_distribuicao = ${lote.ultNsu} WHERE company_id = ${ctx.companyId}
      `);
    });

    documentosNovos += lote.notas.length;
    eventosNovos += lote.eventos.length;
    ultNsu = lote.ultNsu;

    if (lote.statusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') break;
    // Se voltou exatamente na mesma borda do NSU, não tem mais o que buscar agora.
    if (lote.ultNsu <= cfg.ultNsuDistribuicao && pagina === 0) break;

    // A API devolve lotes limitados; se o total combinado bateu no teto de
    // páginas desta chamada, pode ter mais — sinaliza pro usuário sincronizar de novo.
    if (pagina === MAX_PAGINAS_POR_SYNC - 1) temMaisParaSincronizar = true;
  }

  return { documentosNovos, eventosNovos, ultNsu, temMaisParaSincronizar };
}

export interface DistribuicaoResumoMes {
  mes: string; // YYYY-MM
  totalEmitido: number;
  totalRecebido: number;
  qtdEmitido: number;
  qtdRecebido: number;
}

/** Totais por mês (últimos `meses` meses), separando notas emitidas (receita) de recebidas (despesa). Ignora canceladas. */
export async function getResumoMensalDfe(ctx: TenantContext, meses = 6): Promise<DistribuicaoResumoMes[]> {
  return withTenant(ctx.companyId, async (tx) => {
    const res = await tx.execute(sql`
      SELECT
        to_char(date_trunc('month', data_emissao), 'YYYY-MM') AS mes,
        direction,
        count(*)::int AS qtd,
        -- Faturamento é o valor bruto do serviço, não o líquido de retenções.
        coalesce(sum(coalesce(valor_servico, valor_liquido)), 0) AS total
      FROM nfse_distribuicao_doc
      WHERE company_id = ${ctx.companyId}
        AND tipo_documento = 'NFSE'
        AND cancelado = false
        AND data_emissao >= (date_trunc('month', now()) - (${meses - 1} || ' months')::interval)
      GROUP BY 1, 2
      ORDER BY 1 DESC
    `);

    const porMes = new Map<string, DistribuicaoResumoMes>();
    for (const r of res) {
      const mes = r.mes as string;
      if (!porMes.has(mes)) {
        porMes.set(mes, { mes, totalEmitido: 0, totalRecebido: 0, qtdEmitido: 0, qtdRecebido: 0 });
      }
      const entry = porMes.get(mes)!;
      const total = Number(r.total ?? 0);
      const qtd = Number(r.qtd ?? 0);
      if (r.direction === 'EMITIDA') {
        entry.totalEmitido = total;
        entry.qtdEmitido = qtd;
      } else if (r.direction === 'RECEBIDA') {
        entry.totalRecebido = total;
        entry.qtdRecebido = qtd;
      }
    }
    return Array.from(porMes.values()).sort((a, b) => b.mes.localeCompare(a.mes));
  });
}

export interface DistribuicaoDocRow {
  chaveAcesso: string;
  direction: 'EMITIDA' | 'RECEBIDA' | null;
  numeroNfse: string | null;
  municipioEmissao: string | null;
  dataEmissao: string | null;
  valorServico: number | null;
  valorLiquido: number | null;
  prestadorNome: string | null;
  tomadorNome: string | null;
  descricaoServico: string | null;
  cancelado: boolean;
}

/** Lista as notas (não eventos) de um mês específico (YYYY-MM), mais recentes primeiro. */
export async function listDocsDfePorMes(ctx: TenantContext, mes: string): Promise<DistribuicaoDocRow[]> {
  return withTenant(ctx.companyId, async (tx) => {
    const res = await tx.execute(sql`
      SELECT chave_acesso, direction, numero_nfse, municipio_emissao, data_emissao,
             valor_servico, valor_liquido, prestador_nome, tomador_nome, descricao_servico, cancelado
      FROM nfse_distribuicao_doc
      WHERE company_id = ${ctx.companyId}
        AND tipo_documento = 'NFSE'
        AND to_char(data_emissao, 'YYYY-MM') = ${mes}
      ORDER BY data_emissao DESC
    `);
    return res.map((r) => ({
      chaveAcesso: r.chave_acesso as string,
      direction: r.direction as 'EMITIDA' | 'RECEBIDA' | null,
      numeroNfse: r.numero_nfse as string | null,
      municipioEmissao: r.municipio_emissao as string | null,
      dataEmissao: r.data_emissao ? new Date(r.data_emissao as string).toISOString() : null,
      valorServico: r.valor_servico != null ? Number(r.valor_servico) : null,
      valorLiquido: r.valor_liquido != null ? Number(r.valor_liquido) : null,
      prestadorNome: r.prestador_nome as string | null,
      tomadorNome: r.tomador_nome as string | null,
      descricaoServico: r.descricao_servico as string | null,
      cancelado: Boolean(r.cancelado),
    }));
  });
}
