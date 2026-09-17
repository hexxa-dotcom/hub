'use server';

import { getDb } from '@hexxa/db';
import { aguardandoConferencia, conferirELiberar, reabrirMes, iniciarRun, encerrarRun } from '@hexxa/db';
import { requireAdmin, adminUserId } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Conferência do contador — o segundo estágio do fechamento.
 *
 * A IA já apurou, conferiu, resolveu o que dava e trancou o mês para o
 * cliente. O que chega aqui é o parecer: o que ela encontrou, o que consertou
 * e o que sobrou. O contador bate o olho e libera — ou reabre.
 *
 * É a liberação dele que autoriza a saída para a contabilidade oficial. É
 * dele porque é ele quem assina o balanço.
 */

export async function listarAguardando() {
  await requireAdmin();
  return aguardandoConferencia(getDb());
}

export async function liberar(
  companyId: string,
  mes: string,
  nota?: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const userId = await adminUserId();
  const db = getDb();

  const runId = await iniciarRun(db, {
    companyId,
    agent: 'conferencia',
    trigger: 'USER',
    requestedByUserId: userId,
    input: { mes },
  });

  try {
    const r = await conferirELiberar(db, companyId, mes, userId, runId, nota);
    await encerrarRun(db, runId, { summary: r.message });
    revalidatePath('/contador/fechamentos/conferir');
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await encerrarRun(db, runId, { error: msg });
    return { ok: false, message: msg };
  }
}

export async function reabrir(
  companyId: string,
  mes: string,
  motivo: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const r = await reabrirMes(getDb(), companyId, mes, motivo);
  revalidatePath('/contador/fechamentos/conferir');
  return r;
}
