import { pgTable, uuid, text, numeric, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { company, appUser } from './tenancy';
import { journalEntry } from './ledger';
import {
  agentRunStatus,
  agentTrigger,
  agentAutonomy,
  agentActionStatus,
} from './_enums';

/**
 * TRILHA DE AGENTE — quem fez, com base em quê, e quem deixou.
 *
 * O razão (ledger.ts) garante que o resultado FECHA. Estas tabelas garantem
 * que ele é EXPLICÁVEL. São coisas diferentes, e a segunda é o que separa uma
 * IA que opera a empresa de uma IA a que se entregou as chaves.
 *
 * O sistema tinha 53 tabelas e nenhuma respondia "por que este número está
 * aqui?" — nem para um humano. Botar uma IA para escrever num banco assim
 * seria criar dívida que ninguém consegue auditar depois.
 *
 * Três decisões desenhadas juntas:
 *
 * 1. **Proposta e aplicação são estados distintos.** Toda ação nasce como
 *    proposta; aplicar é uma transição. Assim existe um lugar onde a ação da
 *    IA pode ser lida ANTES de virar fato.
 *
 * 2. **Autonomia por valor e reversibilidade, não por confiança do modelo.**
 *    A regra mora em `autonomy-policy.ts`, no sistema — nunca no prompt, onde
 *    seria uma sugestão que o modelo pode ignorar.
 *
 * 3. **Confiança é medida, não declarada.** `confidence` vem de sinais
 *    verificáveis e `evidence` guarda a decomposição. Um número que o modelo
 *    inventa sobre si mesmo não é medida de nada — era exatamente o caso do
 *    `confidenceScore: 0.95` fixo que existia na conciliação.
 */

/** Uma execução de agente, do início ao fim. */
export const agentRun = pgTable(
  'agent_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    /** Identificador estável do agente: 'classificador', 'fechamento'… */
    agent: text('agent').notNull(),
    trigger: agentTrigger('trigger').notNull(),
    status: agentRunStatus('status').notNull().default('RUNNING'),
    /** Quem pediu. Null em execução por cron — e essa ausência é informação. */
    requestedByUserId: uuid('requested_by_user_id').references(() => appUser.id, {
      onDelete: 'set null',
    }),
    /** O que o agente recebeu — parâmetros, escopo, mês de referência. */
    input: jsonb('input'),
    /** O que ele concluiu, em uma frase, para aparecer numa lista. */
    summary: text('summary'),
    error: text('error'),
    /**
     * Modelo e custo. Sem isto não há como responder "quanto custa operar a
     * contabilidade com IA", que é a pergunta que decide se o produto fecha.
     */
    model: text('model'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    costCents: integer('cost_cents'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_agent_run_company').on(t.companyId),
    index('idx_agent_run_agent').on(t.companyId, t.agent, t.startedAt),
  ],
);

/**
 * Uma mudança que o agente propõe (e talvez aplique).
 *
 * Granularidade deliberada: uma ação por FATO, não por execução. Uma varredura
 * que classifica 40 despesas gera 40 ações — assim cada uma pode ser aprovada,
 * rejeitada ou estornada sozinha, e a rejeição de uma não desfaz as outras 39.
 */
export const agentAction = pgTable(
  'agent_action',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRun.id, { onDelete: 'cascade' }),
    /** 'CLASSIFICAR_LANCAMENTO', 'CONCILIAR', 'EMITIR_NFSE', 'FECHAR_MES'… */
    kind: text('kind').notNull(),
    /** Documento afetado — tabela e id, sem FK porque aponta para várias. */
    targetTable: text('target_table').notNull(),
    targetId: uuid('target_id'),
    /** A mudança proposta, no formato que `applyAction` sabe executar. */
    proposal: jsonb('proposal').notNull(),
    /** Por que o agente propôs isto, em linguagem que um contador lê. */
    rationale: text('rationale').notNull(),
    /**
     * Confiança MEDIDA, 0 a 1 — calculada por `measureConfidence` a partir de
     * sinais verificáveis, não auto-relatada pelo modelo.
     */
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    /** Decomposição da confiança: cada sinal, seu peso e o que ele observou. */
    evidence: jsonb('evidence'),
    /** Valor financeiro envolvido — entra na régua de autonomia. */
    amount: numeric('amount', { precision: 14, scale: 2 }),
    autonomy: agentAutonomy('autonomy').notNull(),
    status: agentActionStatus('status').notNull().default('PROPOSED'),
    /** Partida gerada, quando a ação foi contábil. Fecha o elo de auditoria. */
    journalEntryId: uuid('journal_entry_id').references(() => journalEntry.id, {
      onDelete: 'set null',
    }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_agent_action_company').on(t.companyId),
    index('idx_agent_action_run').on(t.agentRunId),
    index('idx_agent_action_status').on(t.companyId, t.status),
    index('idx_agent_action_target').on(t.targetTable, t.targetId),
  ],
);

/**
 * Decisão humana sobre uma ação.
 *
 * Tabela separada e não duas colunas em `agent_action` porque a decisão tem
 * história própria: rejeitar com motivo, reabrir, aprovar depois. Espremer
 * isso em `approved_by`/`approved_at` perderia o "por que não" — que é
 * justamente o que ensina o agente a não propor de novo.
 */
export const agentApproval = pgTable(
  'agent_approval',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => company.id, { onDelete: 'cascade' }),
    agentActionId: uuid('agent_action_id')
      .notNull()
      .references(() => agentAction.id, { onDelete: 'cascade' }),
    /** 'APPROVED' | 'REJECTED' — texto porque o par é fechado e legível. */
    decision: text('decision').notNull(),
    decidedByUserId: uuid('decided_by_user_id').references(() => appUser.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_agent_approval_company').on(t.companyId),
    index('idx_agent_approval_action').on(t.agentActionId),
  ],
);
