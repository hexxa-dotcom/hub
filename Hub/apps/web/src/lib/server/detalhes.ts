import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { getBalancoDreData, lastNMonths } from '@/lib/server/reports';
import { getSimplesInputs, posicaoSimples, type PosicaoSimples } from '@/lib/server/fiscal';
import { nomeDeExibicao } from '@/lib/nome-de-exibicao';

/**
 * DETALHES DA INÍCIO — o mês escolhido a fundo.
 *
 * Os números do topo já dizem quanto; aqui é o porquê: o resultado degrau a
 * degrau (os mesmos números dos Relatórios — faturamento só de nota, imposto
 * pela alíquota da Bússola), para onde foi o dinheiro, o caixa dia a dia,
 * quem comprou, a posição no Simples e a programação do mês.
 *
 * Nada é estimado para preencher buraco: o que não existe aparece vazio.
 */

const seguro = <T,>(p: Promise<T>, padrao: T) => p.catch((e) => (console.error('[detalhes]', e), padrao));

export interface CompromissoDoMes {
  id: string;
  titulo: string;
  categoria: string | null;
  entrada: boolean;
  valor: number;
  vencimento: string;
  situacao: 'PAGO' | 'ABERTO' | 'ATRASADO';
}

export interface DetalhesDoMes {
  mes: string; // AAAA-MM
  noHistorico: boolean;
  fechado: boolean;
  resultado: {
    notas: number;
    imposto: number;
    prolabore: number;
    despesas: number;
    lucro: number;
    distribuido: number;
    outrasEntradas: number;
    margem: number | null;
  };
  /** Lucro dos 6 meses até o escolhido. */
  lucro6: { mes: string; valor: number }[];
  categorias: { nome: string; valor: number }[];
  /** Um item por dia do mês: o que vence entrando e saindo. */
  dias: { entra: number; sai: number }[];
  clientes: { nome: string; valor: number; notas: number }[];
  simples: (PosicaoSimples & { rbt12: number }) | null;
  compromissos: CompromissoDoMes[];
}

export async function detalhesDoMes(ctx: TenantContext, mes: string): Promise<DetalhesDoMes> {
  const inicio = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const diasNoMes = new Date(y, m, 0).getDate();
  const fim = `${mes}-${String(diasNoMes).padStart(2, '0')}`;
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const noHistorico = lastNMonths(12).includes(inicio);

  const [dre, simples, linhas, clientes, extra] = await Promise.all([
    noHistorico ? seguro(getBalancoDreData(ctx, { de: inicio, ate: inicio }), null) : Promise.resolve(null),
    seguro(
      getSimplesInputs(ctx).then(async (e) => ({ ...(await posicaoSimples(ctx, e)), rbt12: e.rbt12 })),
      null,
    ),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT fe.id, fe.description, fe.amount, fe.type, fe.status,
                 to_char(fe.due_date, 'YYYY-MM-DD') AS vencimento, c.name AS categoria
            FROM financial_entry fe
            LEFT JOIN category c ON c.id = fe.category_id
           WHERE fe.company_id = ${ctx.companyId} AND fe.status <> 'CANCELED'
             AND fe.due_date BETWEEN ${inicio}::date AND ${fim}::date
             AND coalesce(fe.description, '') NOT ILIKE 'Provisão de Imposto%'
           ORDER BY fe.due_date, fe.amount DESC
        `),
      ) as unknown as Promise<
        { id: string; description: string | null; amount: string; type: string; status: string; vencimento: string; categoria: string | null }[]
      >,
      [],
    ),
    seguro(
      withTenant(ctx.companyId, (tx) =>
        tx.execute(sql`
          SELECT coalesce(nullif(tomador_documento, ''), tomador_nome, '?') AS chave,
                 max(tomador_nome) AS nome,
                 sum(coalesce(valor_servico, valor_liquido)) AS valor, count(*) AS n
            FROM nfse_distribuicao_doc
           WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND NOT cancelado
             AND to_char(data_emissao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${mes}
           GROUP BY 1
           ORDER BY 3 DESC
        `),
      ) as unknown as Promise<{ nome: string | null; valor: string; n: string }[]>,
      [],
    ),
    seguro(
      withTenant(ctx.companyId, async (tx) => {
        const fechado = await tx.execute(sql`
          SELECT 1 FROM monthly_closure WHERE company_id = ${ctx.companyId} AND reference_month = ${inicio}::date LIMIT 1
        `);
        const dist = await tx.execute(sql`
          SELECT coalesce(sum(amount), 0) AS total FROM profit_distribution
           WHERE company_id = ${ctx.companyId} AND distributed_at BETWEEN ${inicio}::date AND ${fim}::date
        `);
        return { fechado: fechado.length > 0, distribuido: Number((dist[0] as { total: string } | undefined)?.total ?? 0) };
      }),
      { fechado: false, distribuido: 0 },
    ),
  ]);

  const dias = Array.from({ length: diasNoMes }, () => ({ entra: 0, sai: 0 }));
  for (const l of linhas) {
    const d = dias[Number(l.vencimento.slice(8, 10)) - 1];
    if (!d) continue;
    if (l.type === 'RECEIVABLE') d.entra += Number(l.amount);
    else d.sai += Number(l.amount);
  }

  const idx = dre ? dre.monthly.findIndex((x) => x.month === inicio) : -1;
  const lucro6 = dre && idx >= 0 ? dre.monthly.slice(Math.max(0, idx - 5), idx + 1).map((x) => ({ mes: x.month.slice(0, 7), valor: x.lucroLiquido })) : [];

  return {
    mes,
    noHistorico,
    fechado: extra.fechado,
    resultado: {
      notas: dre?.receita ?? 0,
      imposto: dre?.impostoEstimado ?? 0,
      prolabore: dre?.prolabore ?? 0,
      despesas: dre?.despesasOperacionais ?? 0,
      lucro: dre?.lucroLiquido ?? 0,
      distribuido: extra.distribuido,
      outrasEntradas: dre?.outrasEntradas ?? 0,
      // Margem com faturamento quase zero dá −9.000% — isso não informa nada.
      margem: dre && dre.receita > 0 && Math.abs(dre.lucroLiquido / dre.receita) <= 1 ? dre.lucroLiquido / dre.receita : null,
    },
    lucro6,
    categorias: (dre?.categorias ?? []).map(([nome, valor]) => ({ nome, valor })),
    dias,
    clientes: clientes.map((c) => ({ nome: nomeDeExibicao(c.nome || 'Sem nome'), valor: Number(c.valor), notas: Number(c.n) })),
    simples,
    compromissos: linhas.map((l) => ({
      id: l.id,
      titulo: l.description || (l.type === 'RECEIVABLE' ? 'Recebimento' : 'Pagamento'),
      categoria: l.categoria,
      entrada: l.type === 'RECEIVABLE',
      valor: Number(l.amount),
      vencimento: l.vencimento,
      situacao: l.status === 'PAID' ? 'PAGO' : l.vencimento < hoje ? 'ATRASADO' : 'ABERTO',
    })),
  };
}
