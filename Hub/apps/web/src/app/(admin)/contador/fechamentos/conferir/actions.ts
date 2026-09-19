'use server';

import { getDb } from '@hexxa/db';
import {
  aguardandoConferencia, conferirELiberar, reabrirMes, iniciarRun, encerrarRun,
  aguardandoEnvio, autorizarEnvio, configuracaoDaEmpresa,
} from '@hexxa/db';
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
    // O interruptor da tela de operação: liberar já autoriza o envio, ou o
    // envio fica esperando um segundo clique aqui mesmo.
    const cfg = await configuracaoDaEmpresa(db, companyId);
    const junto = cfg.valores.fechamento.envioAutomaticoAoLiberar === true;

    const r = await conferirELiberar(db, companyId, mes, userId, runId, nota, junto);
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

export async function listarAguardandoEnvio() {
  await requireAdmin();
  return aguardandoEnvio(getDb());
}

/**
 * O segundo clique: autoriza o mês liberado a sair para o OneFlow.
 *
 * Só existe para quem deixou `envioAutomaticoAoLiberar` desligado — o padrão,
 * porque o que entra nos livros oficiais de lá só sai por exclusão manual.
 */
export async function autorizarEnvioAction(
  companyId: string,
  mes: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const userId = await adminUserId();
  const r = await autorizarEnvio(getDb(), companyId, mes, userId);
  revalidatePath('/contador/fechamentos/conferir');
  revalidatePath('/contador/fechamentos');
  return r;
}
