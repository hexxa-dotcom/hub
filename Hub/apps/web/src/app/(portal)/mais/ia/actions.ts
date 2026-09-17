'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { listarFilaAprovacao, listarFilaRevisao, decidirAcao } from '@/lib/server/agent-tools';
import { revalidatePath } from 'next/cache';

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
  const [aprovacao, revisao] = await Promise.all([
    listarFilaAprovacao(ctx.companyId),
    listarFilaRevisao(ctx.companyId),
  ]);
  return { aprovacao, revisao };
}

export async function decidir(
  acaoId: string,
  decisao: 'aprovar' | 'rejeitar',
  nota?: string,
): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();

  const r = await decidirAcao(
    ctx.companyId,
    acaoId,
    decisao === 'aprovar' ? 'APPROVED' : 'REJECTED',
    ctx.userId,
    nota,
  );

  revalidatePath('/mais/ia');
  return { ok: r.ok, message: r.mensagem };
}
