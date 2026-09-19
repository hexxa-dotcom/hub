import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { monthlyClosure } from '../schema/accounting';
import { ORIGEM_ONEFLOW } from '../ledger/envio-oneflow';
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
  /**
   * Liberar também autoriza o envio ao OneFlow? Vem de
   * `ConfigFechamento.envioAutomaticoAoLiberar`, lido por quem chama.
   */
  autorizarEnvioJunto = false,
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
      ...(autorizarEnvioJunto
        ? { sendAuthorizedAt: new Date(), sendAuthorizedByUserId: userId }
        : {}),
    })
    .where(eq(monthlyClosure.id, fechamento.id));

  return {
    ok: true,
    message: autorizarEnvioJunto
      ? `${referenceMonth} liberado — o envio ao OneFlow sai na próxima execução.`
      : `${referenceMonth} liberado. O envio ao OneFlow aguarda sua autorização.`,
  };
}

/**
 * Autoriza o envio de um mês já liberado.
 *
 * É o segundo clique, para quem deixou `envioAutomaticoAoLiberar` desligado.
 * Só vale para mês CONFERIDO: autorizar o envio de um mês que o contador não
 * liberou pularia justamente a etapa que protege os livros oficiais.
 */
export async function autorizarEnvio(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  userId: string | null,
): Promise<{ ok: boolean; message: string }> {
  const r = await tx
    .update(monthlyClosure)
    .set({ sendAuthorizedAt: new Date(), sendAuthorizedByUserId: userId })
    .where(
      and(
        eq(monthlyClosure.companyId, companyId),
        eq(monthlyClosure.referenceMonth, referenceMonth),
        eq(monthlyClosure.stage, 'CONFERIDO'),
        sql`${monthlyClosure.sendAuthorizedAt} IS NULL`,
      ),
    )
    .returning({ id: monthlyClosure.id });

  return r.length
    ? { ok: true, message: `Envio de ${referenceMonth} autorizado — sai na próxima execução.` }
    : { ok: false, message: 'O mês precisa estar liberado, e ainda sem envio autorizado.' };
}

/** Meses liberados esperando a autorização de envio. */
export async function aguardandoEnvio(
  tx: DbHandle,
): Promise<{ companyId: string; empresa: string; mes: string; liberadoEm: Date | null }[]> {
  const rows = await tx.execute(sql`
    SELECT mc.company_id::text, c.legal_name, to_char(mc.reference_month,'YYYY-MM-DD') AS mes,
           mc.reviewed_at
    FROM monthly_closure mc
    JOIN company c ON c.id = mc.company_id
    WHERE mc.stage = 'CONFERIDO' AND mc.send_authorized_at IS NULL
    ORDER BY mc.reference_month, c.legal_name
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    companyId: String(r.company_id),
    empresa: String(r.legal_name),
    mes: String(r.mes),
    liberadoEm: (r.reviewed_at as Date) ?? null,
  }));
}

/**
 * Fecha a cadeia: mês autorizado sem mais nada a enviar vira ENVIADO.
 *
 * Sem isto o estágio ENVIADO não era alcançado por caminho nenhum — a tela
 * de fechamentos tinha o rótulo, e nenhum mês chegava a ele.
 *
 * "Nada a enviar" conta só o que o envio mandaria — a mesma seleção de
 * `ensaiarEnvio`. Partida bloqueada por falta de de-para segura o mês em
 * CONFERIDO, e deve: o mês não chegou inteiro lá.
 */
export async function concluirEnviados(tx: DbHandle, companyId: string): Promise<number> {
  const r = await tx.execute(sql`
    UPDATE monthly_closure mc
       SET stage = 'ENVIADO', sent_at = NOW()
     WHERE mc.company_id = ${companyId}
       AND mc.stage = 'CONFERIDO'
       AND mc.send_authorized_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM journal_entry j
          WHERE j.company_id = mc.company_id
            AND j.reference_month = mc.reference_month
            AND j.status = 'POSTED'
            AND j.reversed_by IS NULL
            AND j.source <> 'CLOSING'
            AND NOT ${ORIGEM_ONEFLOW}
            -- Mesma regra do ensaio: espelho de estorno só conta como
            -- pendente se a partida que ele anula foi enviada — senão ele
            -- nunca vai, e o mês ficaria preso em CONFERIDO para sempre.
            AND (
              j.event <> 'REVERSAL'
              OR EXISTS (SELECT 1 FROM journal_entry orig
                           JOIN oneflow_envio env ON env.journal_entry_id = orig.id
                                                 AND env.status = 'ENVIADO'
                          WHERE orig.reversed_by = j.id)
            )
            AND NOT EXISTS (SELECT 1 FROM oneflow_envio e
                             WHERE e.journal_entry_id = j.id AND e.status = 'ENVIADO')
       )
    RETURNING mc.id
  `);
  return (r as unknown as unknown[]).length;
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
    // A autorização de envio cai junto: ela valia para os números de antes.
    // Sem limpar, o mês reliberado sairia para o OneFlow sem o segundo
    // clique — mesmo com o envio automático desligado.
    .set({ stage: 'REABERTO', reviewNote: motivo, sendAuthorizedAt: null, sendAuthorizedByUserId: null })
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
