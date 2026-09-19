'use server';

import { getTenantContext } from '@/lib/server/tenant';
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

export async function listarFilas() {
  const ctx = await getTenantContext();
  const [aprovacao, revisao, categorias] = await Promise.all([
    listarFilaAprovacao(ctx.companyId),
    listarFilaRevisao(ctx.companyId),
    getDb().execute(sql`
      SELECT id::text, name FROM category WHERE company_id = ${ctx.companyId} ORDER BY name
    `) as unknown as Promise<{ id: string; name: string }[]>,
  ]);
  return { aprovacao, revisao, categorias: categorias.map((c) => ({ id: c.id, nome: c.name })) };
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
    ctx.userId,
    nota,
    categoriaCorretaId,
  );

  revalidatePath('/mais/ia');
  return { ok: r.ok, message: r.mensagem };
}
