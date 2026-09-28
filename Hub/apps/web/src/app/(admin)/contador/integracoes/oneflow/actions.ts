'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * Decisões do escritório sobre o envio ao OneFlow — o que o sistema não pode
 * decidir sozinho sem arriscar lançamento em dobro nos livros oficiais.
 */

/**
 * Envio incerto conferido no OneFlow pelo documento HUB-…:
 *   'ESTA_LA'  → marca como enviado (sem o id de lá; excluir, se precisar, é à mão).
 *   'REENVIAR' → não está lá: a marca sai e a partida volta para a fila da madrugada.
 */
export async function resolverEnvioIncertoAction(envioId: string, decisao: 'ESTA_LA' | 'REENVIAR'): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const db = getDb();
  if (decisao === 'ESTA_LA') {
    await db.execute(sql`
      UPDATE oneflow_envio SET status = 'ENVIADO', erro = coalesce(erro, '') || ' · conferido no OneFlow pelo escritório', enviado_em = NOW()
       WHERE id = ${envioId}::uuid AND status IN ('INCERTO', 'ENVIANDO')`);
  } else {
    await db.execute(sql`DELETE FROM oneflow_envio WHERE id = ${envioId}::uuid AND status IN ('INCERTO', 'ENVIANDO')`);
  }
  revalidatePath('/contador/integracoes/oneflow');
  return { ok: true, mensagem: decisao === 'ESTA_LA' ? 'Marcado como enviado.' : 'Volta para a fila: sai no próximo turno da madrugada.' };
}

/** Recusadas no máximo de tentativas: zera as tentativas da empresa para o envio voltar a tentar. */
export async function tentarDeNovoAction(companyId: string): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const r = (await getDb().execute(sql`
    DELETE FROM oneflow_envio e
     WHERE e.company_id = ${companyId}::uuid AND e.status = 'ERRO'
       AND NOT EXISTS (SELECT 1 FROM oneflow_envio o WHERE o.journal_entry_id = e.journal_entry_id AND o.status IN ('ENVIADO', 'ENVIANDO', 'INCERTO'))
    RETURNING e.journal_entry_id`)) as unknown as unknown[];
  revalidatePath('/contador/integracoes/oneflow');
  return { ok: true, mensagem: `${r.length} tentativa(s) zerada(s): o envio tenta de novo na próxima madrugada.` };
}
