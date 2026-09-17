import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { monthlyClosure } from '../schema/accounting';
import { propor, marcarAplicada, decidir } from './repository';

/**
 * ESTÁGIOS DO FECHAMENTO.
 *
 * Dois fatos, dois donos:
 *
 * - **FECHADO** — a IA apurou, conferiu e trancou o mês. O cliente não lança
 *   mais nele (trigger no banco, migration 0054). É reversível e interno.
 * - **CONFERIDO** — o contador olhou o parecer e liberou. É o que autoriza a
 *   saída para a contabilidade oficial, e por isso exige decisão humana.
 *
 * Colapsar os dois num campo só faria uma das duas coisas erradas: ou a IA
 * mandaria para o contábil sem ninguém olhar, ou o cliente ficaria esperando
 * alguém destravar o mês dele para voltar a trabalhar.
 */

export type Estagio = 'ABERTO' | 'FECHADO' | 'CONFERIDO' | 'ENVIADO' | 'REABERTO';

export interface ParecerDoMes {
  podeFechar: boolean;
  resumo: string;
  ocorrencias: unknown[];
  resolvidoPelaIA: unknown[];
  pedidosAoCliente: unknown[];
}

/**
 * A IA tranca o mês.
 *
 * Só quando não há bloqueio: trancar um mês que a própria conferência reprovou
 * seria congelar um número errado e ainda impedir o cliente de corrigi-lo.
 */
export async function fecharParaOCliente(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  parecer: ParecerDoMes,
  agentRunId: string,
  totais: { receita: number; despesa: number },
): Promise<{ fechado: boolean; motivo?: string }> {
  if (!parecer.podeFechar) {
    return { fechado: false, motivo: parecer.resumo };
  }

  const [existente] = await tx
    .select({ id: monthlyClosure.id, stage: monthlyClosure.stage })
    .from(monthlyClosure)
    .where(
      and(
        eq(monthlyClosure.companyId, companyId),
        eq(monthlyClosure.referenceMonth, referenceMonth),
      ),
    );

  // Mês já conferido ou enviado não volta para FECHADO: seria desfazer a
  // decisão do contador por um caminho que ninguém pediu.
  if (existente && ['CONFERIDO', 'ENVIADO'].includes(existente.stage)) {
    return { fechado: false, motivo: `Mês já está ${existente.stage.toLowerCase()}.` };
  }

  const valores = {
    stage: 'FECHADO' as const,
    closedAt: new Date(),
    closedByRunId: agentRunId,
    parecer: parecer as never,
    totalRevenue: totais.receita.toFixed(2),
    totalExpenses: totais.despesa.toFixed(2),
  };

  if (existente) {
    await tx.update(monthlyClosure).set(valores).where(eq(monthlyClosure.id, existente.id));
  } else {
    await tx.insert(monthlyClosure).values({
      companyId,
      referenceMonth,
      newContractsCount: 0,
      defaultsCount: 0,
      ...valores,
    });
  }

  return { fechado: true };
}

/**
 * O contador confere e libera.
 *
 * Registra a decisão como ação de agente aprovada, para que a liberação
 * apareça na mesma trilha de tudo que a IA fez — quem revisa depois precisa
 * ver a sequência inteira num lugar só.
 */
export async function conferirELiberar(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  userId: string | null,
  agentRunId: string,
  nota?: string,
): Promise<{ ok: boolean; message: string }> {
  const [fechamento] = await tx
    .select({ id: monthlyClosure.id, stage: monthlyClosure.stage })
    .from(monthlyClosure)
    .where(
      and(
        eq(monthlyClosure.companyId, companyId),
        eq(monthlyClosure.referenceMonth, referenceMonth),
      ),
    );

  if (!fechamento) return { ok: false, message: 'Mês ainda não foi fechado pela IA.' };
  if (fechamento.stage !== 'FECHADO') {
    return { ok: false, message: `Mês está ${fechamento.stage.toLowerCase()}, não aguardando conferência.` };
  }

  const acao = await propor(tx, {
    companyId,
    agentRunId,
    kind: 'LIBERAR_CONTABIL',
    targetTable: 'monthly_closure',
    targetId: fechamento.id,
    proposal: { mes: referenceMonth },
    rationale: `Conferência do contador para ${referenceMonth}.${nota ? ` ${nota}` : ''}`,
    confianca: {
      score: 1,
      sinais: [{ nome: 'decisao_humana', forca: 1, peso: 1, observado: 'Conferido pelo contador.' }],
      resumo: 'Decisão humana.',
    },
    amount: null,
  });

  // A aprovação precisa existir ANTES de aplicar: o trigger do banco recusa
  // aplicar ação de nível APPROVAL sem aprovação registrada.
  await decidir(tx, companyId, acao.id, 'APPROVED', userId, nota);
  await marcarAplicada(tx, acao.id);

  await tx
    .update(monthlyClosure)
    .set({
      stage: 'CONFERIDO',
      reviewedAt: new Date(),
      reviewedByUserId: userId,
      reviewNote: nota ?? null,
    })
    .where(eq(monthlyClosure.id, fechamento.id));

  return { ok: true, message: `${referenceMonth} liberado para a contabilidade.` };
}

/** Reabre um mês fechado. Exige motivo — muda número já apresentado como final. */
export async function reabrirMes(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  motivo: string,
): Promise<{ ok: boolean; message: string }> {
  if (motivo.trim().length < 5) {
    return { ok: false, message: 'Informe o motivo da reabertura.' };
  }

  const r = await tx
    .update(monthlyClosure)
    .set({ stage: 'REABERTO', reviewNote: motivo })
    .where(
      and(
        eq(monthlyClosure.companyId, companyId),
        eq(monthlyClosure.referenceMonth, referenceMonth),
        sql`${monthlyClosure.stage} IN ('FECHADO', 'CONFERIDO')`,
      ),
    )
    .returning({ id: monthlyClosure.id });

  return r.length
    ? { ok: true, message: `${referenceMonth} reaberto. O cliente voltou a poder lançar.` }
    : { ok: false, message: 'Mês não está num estágio que permita reabertura.' };
}

/** Meses fechados pela IA aguardando a conferência do contador. */
export async function aguardandoConferencia(
  tx: DbHandle,
): Promise<{ companyId: string; empresa: string; mes: string; fechadoEm: Date | null; parecer: unknown }[]> {
  const rows = await tx.execute(sql`
    SELECT mc.company_id::text, c.legal_name, to_char(mc.reference_month,'YYYY-MM-DD') AS mes,
           mc.closed_at, mc.parecer
    FROM monthly_closure mc
    JOIN company c ON c.id = mc.company_id
    WHERE mc.stage = 'FECHADO'
    ORDER BY mc.reference_month DESC, c.legal_name
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    companyId: String(r.company_id),
    empresa: String(r.legal_name),
    mes: String(r.mes),
    fechadoEm: (r.closed_at as Date) ?? null,
    parecer: r.parecer,
  }));
}
