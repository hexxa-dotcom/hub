'use server';

import { getTenantContext, autorOuNulo } from '@/lib/server/tenant';
import { listarFilaAprovacao, listarFilaRevisao, decidirAcao } from '@/lib/server/agent-tools';
import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';

/**
 * Fila de decisões sobre o que a IA fez ou quer fazer.
 *
 * Duas filas com significados diferentes:
 *
 * - **Aprovação**: a IA quer fazer e está travada. Nada acontece sem decisão.
 * - **Revisão**: a IA já fez, dentro do que pode fazer sozinha, e alguém
 *   deveria conferir depois.
 *
 * A segunda é o contrapeso da autonomia — sem ela, "roda sozinho" viraria
 * "ninguém nunca olha". E é dela que sai o aprendizado: cada rejeição é um par
 * rotulado que a confiança medida lê na próxima vez.
 */

/**
 * As filas, opcionalmente só de um tipo de ação.
 *
 * Existe filtro porque as duas metades da fila moram em telas diferentes: a
 * classificação de lançamento na Conciliação, o fechamento de mês no
 * Fechamento. Sem o filtro, cada tela mostraria a pendência da outra, e o
 * cliente decidiria sobre fechamento numa tela de extrato.
 */
export async function listarFilas(kinds?: string[]) {
  const ctx = await getTenantContext();
  const [aprovacao, revisao, categorias] = await Promise.all([
    listarFilaAprovacao(ctx.companyId),
    listarFilaRevisao(ctx.companyId),
    getDb().execute(sql`
      SELECT id::text, name FROM category WHERE company_id = ${ctx.companyId} ORDER BY name
    `) as unknown as Promise<{ id: string; name: string }[]>,
  ]);
  const doTipo = <T extends { kind: string }>(lista: T[]) =>
    kinds?.length ? lista.filter((a) => kinds.includes(a.kind)) : lista;

  return {
    aprovacao: doTipo(aprovacao),
    revisao: doTipo(revisao),
    categorias: categorias.map((c) => ({ id: c.id, nome: c.name })),
  };
}

export async function decidir(
  acaoId: string,
  decisao: 'aprovar' | 'rejeitar',
  nota?: string,
  /** Categoria certa — obrigatória ao dizer que uma classificação estava errada. */
  categoriaCorretaId?: string,
): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();

  const r = await decidirAcao(
    ctx.companyId,
    acaoId,
    decisao === 'aprovar' ? 'APPROVED' : 'REJECTED',
    autorOuNulo(ctx.userId),
    nota,
    categoriaCorretaId,
  );

  // As duas telas que hospedam a fila. Revalidar só uma deixaria a outra
  // mostrando um item já decidido.
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/meu-negocio/relatorios/fechamento');
  return { ok: r.ok, message: r.mensagem };
}

export async function decidirTodas(
  itens: { acaoId: string; decisao: 'aprovar' | 'rejeitar'; categoriaCorretaId?: string }[],
): Promise<{ ok: boolean; message: string }> {
  if (itens.length === 0) return { ok: true, message: 'Nenhuma ação a processar.' };

  const ctx = await getTenantContext();
  const userId = autorOuNulo(ctx.userId);

  for (const item of itens) {
    try {
      await decidirAcao(
        ctx.companyId,
        item.acaoId,
        item.decisao === 'aprovar' ? 'APPROVED' : 'REJECTED',
        userId,
        undefined,
        item.categoriaCorretaId,
      );
    } catch (err) {
      console.error(`Erro ao decidir ação ${item.acaoId} em lote:`, err);
    }
  }

  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/meu-negocio/relatorios/fechamento');
  return { ok: true, message: `${itens.length} ação(ões) confirmada(s) com sucesso.` };
}
