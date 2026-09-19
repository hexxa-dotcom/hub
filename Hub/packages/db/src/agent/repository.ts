import { and, eq, desc, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { agentRun, agentAction, agentApproval } from '../schema/agent';
import { decidirAutonomia, type ActionKind, type Autonomy, type Confianca } from '@hexxa/core';

/**
 * CICLO DE VIDA DA AÇÃO DE AGENTE.
 *
 * O contrato é curto de propósito:
 *
 *   iniciarRun → propor(…)* → aplicar(…) | aprovar/rejeitar → encerrarRun
 *
 * `propor` é o único caminho para criar uma ação, e ele mesmo chama a régua de
 * autonomia. Não existe API para gravar uma ação com o nível de autonomia
 * escolhido por quem chama — senão o agente poderia declarar-se autônomo, que
 * é precisamente o que a régua existe para impedir.
 */

export interface IniciarRunInput {
  companyId: string;
  agent: string;
  trigger: 'CRON' | 'USER' | 'API' | 'WEBHOOK';
  requestedByUserId?: string | null;
  input?: unknown;
  model?: string | null;
}

export async function iniciarRun(tx: DbHandle, i: IniciarRunInput): Promise<string> {
  const [row] = await tx
    .insert(agentRun)
    .values({
      companyId: i.companyId,
      agent: i.agent,
      trigger: i.trigger,
      status: 'RUNNING',
      requestedByUserId: i.requestedByUserId ?? null,
      input: (i.input ?? null) as never,
      model: i.model ?? null,
    })
    .returning({ id: agentRun.id });
  return row!.id;
}

export interface EncerrarRunInput {
  summary?: string;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  costCents?: number;
}

/**
 * Fecha a execução. O status é derivado das ações, não informado: uma execução
 * que produziu três ações aplicadas e uma falha é PARTIAL, e quem escreveu o
 * agente não tem como "arredondar" isso para sucesso.
 */
export async function encerrarRun(
  tx: DbHandle,
  runId: string,
  i: EncerrarRunInput = {},
): Promise<'SUCCEEDED' | 'PARTIAL' | 'FAILED'> {
  const [contagem] = (await tx.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'FAILED')::int AS falhas,
      count(*)::int AS total
    FROM agent_action WHERE agent_run_id = ${runId}
  `)) as unknown as { falhas: number; total: number }[];

  const falhas = Number(contagem?.falhas ?? 0);
  const total = Number(contagem?.total ?? 0);

  const status = i.error
    ? 'FAILED'
    : falhas === 0
      ? 'SUCCEEDED'
      : falhas === total
        ? 'FAILED'
        : 'PARTIAL';

  await tx
    .update(agentRun)
    .set({
      status,
      summary: i.summary ?? null,
      error: i.error ?? null,
      tokensIn: i.tokensIn ?? null,
      tokensOut: i.tokensOut ?? null,
      costCents: i.costCents ?? null,
      finishedAt: new Date(),
    })
    .where(eq(agentRun.id, runId));

  return status;
}

export interface ProporInput {
  companyId: string;
  agentRunId: string;
  kind: ActionKind;
  targetTable: string;
  targetId?: string | null;
  proposal: unknown;
  rationale: string;
  /** Resultado de `measureConfidence` — score E decomposição. */
  confianca: Confianca;
  amount?: number | null;
}

export interface AcaoProposta {
  id: string;
  autonomy: Autonomy;
  /** `true` quando a ação pode ser aplicada agora, sem passar por humano. */
  podeAplicar: boolean;
  motivo: string;
}

/**
 * Registra uma proposta e classifica sua autonomia.
 *
 * A régua é chamada AQUI, e não por quem chama, porque este é o gargalo por
 * onde toda ação de agente passa. Deixar a classificação a cargo do agente
 * seria pedir ao candidato que corrija a própria prova.
 */
export async function propor(tx: DbHandle, i: ProporInput): Promise<AcaoProposta> {
  const decisao = decidirAutonomia(i.kind, i.amount ?? null, i.confianca.score);

  const status = decisao.autonomy === 'APPROVAL' ? 'AWAITING_APPROVAL' : 'PROPOSED';

  const [row] = await tx
    .insert(agentAction)
    .values({
      companyId: i.companyId,
      agentRunId: i.agentRunId,
      kind: i.kind,
      targetTable: i.targetTable,
      targetId: i.targetId ?? null,
      proposal: i.proposal as never,
      // A justificativa do agente MAIS o motivo da régua: quem revisa precisa
      // ver tanto "por que isto" quanto "por que preciso olhar isto".
      rationale: `${i.rationale}\n\nAutonomia: ${decisao.motivo}`,
      confidence: i.confianca.score.toFixed(3),
      evidence: { sinais: i.confianca.sinais, resumo: i.confianca.resumo } as never,
      amount: i.amount == null ? null : i.amount.toFixed(2),
      autonomy: decisao.autonomy,
      status,
    })
    .returning({ id: agentAction.id });

  return {
    id: row!.id,
    autonomy: decisao.autonomy,
    podeAplicar: decisao.autonomy !== 'APPROVAL',
    motivo: decisao.motivo,
  };
}

/**
 * Marca a ação como aplicada.
 *
 * Não executa nada: quem sabe aplicar é o chamador, que conhece o domínio.
 * Este módulo só registra o fato — e o trigger do banco recusa a transição
 * quando falta aprovação, mesmo que este código deixe passar.
 */
export async function marcarAplicada(
  tx: DbHandle,
  actionId: string,
  journalEntryId?: string | null,
): Promise<void> {
  await tx
    .update(agentAction)
    .set({ status: 'APPLIED', appliedAt: new Date(), journalEntryId: journalEntryId ?? null })
    .where(eq(agentAction.id, actionId));
}

export async function marcarFalhada(tx: DbHandle, actionId: string, erro: string): Promise<void> {
  await tx
    .update(agentAction)
    .set({ status: 'FAILED', error: erro })
    .where(eq(agentAction.id, actionId));
}

/** Registra a decisão humana. Rejeição guarda o motivo — é o que ensina. */
export async function decidir(
  tx: DbHandle,
  companyId: string,
  actionId: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedByUserId: string | null,
  note?: string,
): Promise<void> {
  await tx.insert(agentApproval).values({
    companyId,
    agentActionId: actionId,
    decision,
    decidedByUserId,
    note: note ?? null,
  });

  await tx
    .update(agentAction)
    .set({ status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' })
    .where(and(eq(agentAction.id, actionId), eq(agentAction.companyId, companyId)));
}

/* ── Leitura ────────────────────────────────────────────────────────────── */

export interface AcaoPendente {
  id: string;
  kind: string;
  rationale: string;
  confidence: number;
  amount: number | null;
  autonomy: Autonomy;
  targetTable: string;
  targetId: string | null;
  proposal: unknown;
  evidence: unknown;
  agent: string;
  createdAt: Date;
}

/** Fila de aprovação — o que a IA quer fazer e está esperando alguém deixar. */
export async function listarPendentesDeAprovacao(
  tx: DbHandle,
  companyId: string,
  limite = 100,
): Promise<AcaoPendente[]> {
  const rows = await tx
    .select({
      id: agentAction.id,
      kind: agentAction.kind,
      rationale: agentAction.rationale,
      confidence: agentAction.confidence,
      amount: agentAction.amount,
      autonomy: agentAction.autonomy,
      targetTable: agentAction.targetTable,
      targetId: agentAction.targetId,
      proposal: agentAction.proposal,
      evidence: agentAction.evidence,
      agent: agentRun.agent,
      createdAt: agentAction.createdAt,
    })
    .from(agentAction)
    .innerJoin(agentRun, eq(agentRun.id, agentAction.agentRunId))
    .where(
      and(eq(agentAction.companyId, companyId), eq(agentAction.status, 'AWAITING_APPROVAL')),
    )
    .orderBy(desc(agentAction.createdAt))
    .limit(limite);

  return rows.map((r) => ({
    ...r,
    confidence: Number(r.confidence),
    amount: r.amount === null ? null : Number(r.amount),
    autonomy: r.autonomy as Autonomy,
  }));
}

/**
 * Fila de revisão posterior: aplicado sozinho, mas alguém deveria conferir.
 *
 * É o compromisso central da autonomia graduada — a IA não trava o trabalho
 * esperando aprovação para coisa pequena, e mesmo assim nada que ela fez passa
 * despercebido.
 */
export async function listarParaRevisao(
  tx: DbHandle,
  companyId: string,
  limite = 100,
): Promise<AcaoPendente[]> {
  const rows = await tx
    .select({
      id: agentAction.id,
      kind: agentAction.kind,
      rationale: agentAction.rationale,
      confidence: agentAction.confidence,
      amount: agentAction.amount,
      autonomy: agentAction.autonomy,
      targetTable: agentAction.targetTable,
      targetId: agentAction.targetId,
      proposal: agentAction.proposal,
      evidence: agentAction.evidence,
      agent: agentRun.agent,
      createdAt: agentAction.createdAt,
    })
    .from(agentAction)
    .innerJoin(agentRun, eq(agentRun.id, agentAction.agentRunId))
    .where(
      and(
        eq(agentAction.companyId, companyId),
        eq(agentAction.autonomy, 'REVIEW'),
        eq(agentAction.status, 'APPLIED'),
        sql`NOT EXISTS (SELECT 1 FROM agent_approval a WHERE a.agent_action_id = ${agentAction.id})`,
      ),
    )
    .orderBy(desc(agentAction.appliedAt))
    .limit(limite);

  return rows.map((r) => ({
    ...r,
    confidence: Number(r.confidence),
    amount: r.amount === null ? null : Number(r.amount),
    autonomy: r.autonomy as Autonomy,
  }));
}

/**
 * Histórico de um documento: tudo que um agente já propôs sobre ele.
 *
 * Responde "por que este número está aqui?" — a pergunta que o sistema não
 * conseguia responder nem para um humano antes desta camada existir.
 */
export async function historicoDoDocumento(
  tx: DbHandle,
  companyId: string,
  targetTable: string,
  targetId: string,
): Promise<AcaoPendente[]> {
  const rows = await tx
    .select({
      id: agentAction.id,
      kind: agentAction.kind,
      rationale: agentAction.rationale,
      confidence: agentAction.confidence,
      amount: agentAction.amount,
      autonomy: agentAction.autonomy,
      targetTable: agentAction.targetTable,
      targetId: agentAction.targetId,
      proposal: agentAction.proposal,
      evidence: agentAction.evidence,
      agent: agentRun.agent,
      createdAt: agentAction.createdAt,
    })
    .from(agentAction)
    .innerJoin(agentRun, eq(agentRun.id, agentAction.agentRunId))
    .where(
      and(
        eq(agentAction.companyId, companyId),
        eq(agentAction.targetTable, targetTable),
        eq(agentAction.targetId, targetId),
      ),
    )
    .orderBy(desc(agentAction.createdAt));

  return rows.map((r) => ({
    ...r,
    confidence: Number(r.confidence),
    amount: r.amount === null ? null : Number(r.amount),
    autonomy: r.autonomy as Autonomy,
  }));
}

/* ── Fila do escritório ─────────────────────────────────────────────────── */

export interface ItemDaFilaDoEscritorio {
  id: string;
  companyId: string;
  empresa: string;
  kind: string;
  fila: 'APROVACAO' | 'REVISAO';
  rationale: string;
  confidence: number;
  amount: number | null;
  /** Lançamento alvo, quando a ação é sobre um. */
  lancamento: { id: string; descricao: string; data: string | null } | null;
  /** O que a IA escolheu, quando é classificação. */
  categoriaEscolhida: string | null;
  createdAt: Date;
}

/**
 * As duas filas de todas as empresas, numa lista só.
 *
 * ── Por que existe ──────────────────────────────────────────────────────
 *
 * A fila vivia no portal do CLIENTE, presa à empresa de quem estava logado.
 * Para conferir o que a IA fez, o contador precisaria entrar em cada cliente
 * — e com cinquenta clientes isso não acontece, que é o mesmo que a fila não
 * existir. Revisar o que a IA classificou é trabalho do contador, e ele
 * precisa ver tudo de uma vez.
 *
 * Aprovação vem antes de revisão: aprovação é algo parado esperando alguém;
 * revisão é algo que já aconteceu e precisa de um segundo olhar.
 */
export async function filaDoEscritorio(
  tx: DbHandle,
  limite = 300,
): Promise<ItemDaFilaDoEscritorio[]> {
  const rows = (await tx.execute(sql`
    SELECT a.id::text, a.company_id::text, c.legal_name, a.kind::text, a.rationale,
           a.confidence, a.amount, a.created_at,
           CASE WHEN a.status = 'AWAITING_APPROVAL' THEN 'APROVACAO' ELSE 'REVISAO' END AS fila,
           a.proposal->>'categoriaNome' AS categoria,
           fe.id::text AS fe_id, fe.description AS fe_desc,
           to_char(COALESCE(fe.paid_at, fe.due_date), 'YYYY-MM-DD') AS fe_data
      FROM agent_action a
      JOIN company c ON c.id = a.company_id
      LEFT JOIN financial_entry fe
        ON a.target_table = 'financial_entry' AND fe.id = a.target_id
     WHERE a.status = 'AWAITING_APPROVAL'
        OR (a.autonomy = 'REVIEW' AND a.status = 'APPLIED'
            AND NOT EXISTS (SELECT 1 FROM agent_approval ap WHERE ap.agent_action_id = a.id))
     ORDER BY (a.status = 'AWAITING_APPROVAL') DESC, c.legal_name, a.created_at DESC
     LIMIT ${String(limite)}::int
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    empresa: String(r.legal_name),
    kind: String(r.kind),
    fila: r.fila === 'APROVACAO' ? 'APROVACAO' : 'REVISAO',
    rationale: String(r.rationale ?? ''),
    confidence: Number(r.confidence),
    amount: r.amount === null ? null : Number(r.amount),
    lancamento: r.fe_id
      ? { id: String(r.fe_id), descricao: String(r.fe_desc ?? ''), data: (r.fe_data as string) ?? null }
      : null,
    categoriaEscolhida: (r.categoria as string) ?? null,
    createdAt: r.created_at as Date,
  }));
}
