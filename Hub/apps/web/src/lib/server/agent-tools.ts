import 'server-only';
import { getDb, eq, and, sql } from '@hexxa/db';
import { financialEntry, category, bankTransaction, reconciliationMatch, agentAction } from '@hexxa/db/schema';
import {
  iniciarRun,
  encerrarRun,
  propor,
  marcarAplicada,
  marcarFalhada,
  decidir,
  listarPendentesDeAprovacao,
  listarParaRevisao,
  historicoDoDocumento,
  reescriturarLancamento,
} from '@hexxa/db';
import {
  confiancaClassificacao,
  confiancaConciliacao,
  type ActionKind,
  type Confianca,
} from '@hexxa/core';
import { escriturar } from './ledger';

/**
 * SUPERFÍCIE DE ESCRITA DO AGENTE.
 *
 * Até aqui as 11 ferramentas MCP eram todas de leitura: um agente conectado
 * enxergava a empresa inteira e não conseguia mexer em nada. Estas funções são
 * as mãos — e existem só porque agora existe freio (a régua de autonomia) e
 * rastro (a trilha), construídos antes de propósito.
 *
 * Invariante desta camada: **nenhuma função escreve no domínio sem antes
 * passar por `propor`**. Propor é o que classifica a autonomia, mede a
 * confiança e grava a justificativa. Uma ferramenta que escrevesse direto
 * seria uma porta dos fundos pela qual a IA opera sem rastro — e ela seria
 * usada, porque é mais curta.
 *
 * O formato de retorno é uniforme e inclui o caso "ficou esperando aprovação".
 * Isso é deliberado: para o agente, ser barrado não é erro, é uma resposta
 * possível — e ele precisa saber contar isso ao usuário em vez de tentar de
 * novo por outro caminho.
 */

export interface ResultadoFerramenta {
  ok: boolean;
  /** 'aplicado' | 'aguardando_aprovacao' | 'recusado' | 'erro' */
  situacao: 'aplicado' | 'aguardando_aprovacao' | 'recusado' | 'erro';
  mensagem: string;
  acaoId?: string;
  confianca?: number;
  evidencia?: string;
}

/** Envelope de execução: toda ferramenta de escrita roda dentro de um run. */
async function comRun<T>(
  companyId: string,
  agente: string,
  trigger: 'CRON' | 'USER' | 'API' | 'WEBHOOK',
  userId: string | null,
  input: unknown,
  fn: (runId: string) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const runId = await iniciarRun(db, {
    companyId,
    agent: agente,
    trigger,
    requestedByUserId: userId,
    input,
  });
  try {
    const r = await fn(runId);
    await encerrarRun(db, runId);
    return r;
  } catch (err) {
    await encerrarRun(db, runId, { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Classificar lançamento — a lacuna mais cara do sistema hoje
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Mede a confiança de classificar um lançamento numa categoria, a partir do
 * histórico REAL de classificações da empresa.
 *
 * Nada aqui vem do modelo: são contagens sobre o que humanos já classificaram.
 * O modelo entra depois, como um sinal de peso 1 entre outros — e só quando
 * quem chama passa a opinião dele.
 */
async function medirConfiancaClassificacao(
  companyId: string,
  descricao: string,
  partnerId: string | null,
  categoryId: string,
  opiniaoModelo?: { autoavaliacao: number; justificativa: string },
): Promise<Confianca> {
  const db = getDb();

  const [h] = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE e.description = ${descricao} AND e.category_id = ${categoryId})::int AS acertos_desc,
      count(*) FILTER (WHERE e.description = ${descricao} AND e.category_id <> ${categoryId})::int AS div_desc,
      count(*) FILTER (WHERE e.partner_id IS NOT NULL AND e.partner_id = ${partnerId}
                        AND e.category_id = ${categoryId})::int AS acertos_forn,
      count(*) FILTER (WHERE e.partner_id IS NOT NULL AND e.partner_id = ${partnerId}
                        AND e.category_id <> ${categoryId})::int AS div_forn
    FROM financial_entry e
    WHERE e.company_id = ${companyId} AND e.category_id IS NOT NULL
  `)) as unknown as Record<string, number>[];

  return confiancaClassificacao(
    {
      acertosDescricao: Number(h?.acertos_desc ?? 0),
      divergenciasDescricao: Number(h?.div_desc ?? 0),
      acertosFornecedor: Number(h?.acertos_forn ?? 0),
      divergenciasFornecedor: Number(h?.div_forn ?? 0),
    },
    opiniaoModelo,
  );
}

export interface ClassificarInput {
  companyId: string;
  lancamentoId: string;
  categoriaId: string;
  /** Justificativa do agente, em linguagem que um contador lê. */
  justificativa: string;
  /** Opinião do próprio modelo — sinal de peso baixo, opcional. */
  opiniaoModelo?: { autoavaliacao: number; justificativa: string };
  userId?: string | null;
  trigger?: 'CRON' | 'USER' | 'API';
}

/**
 * Atribui categoria contábil a um lançamento.
 *
 * É a ação de maior valor imediato do sistema: hoje 100% dos lançamentos estão
 * sem categoria, e por isso toda a despesa da empresa aparece no balancete numa
 * única conta "a classificar". Cada classificação correta move uma linha do
 * limbo para a DRE.
 */
export async function classificarLancamento(i: ClassificarInput): Promise<ResultadoFerramenta> {
  const db = getDb();

  const [alvo] = await db
    .select({
      id: financialEntry.id,
      description: financialEntry.description,
      amount: financialEntry.amount,
      partnerId: financialEntry.partnerId,
      categoryIdAtual: financialEntry.categoryId,
    })
    .from(financialEntry)
    .where(and(eq(financialEntry.id, i.lancamentoId), eq(financialEntry.companyId, i.companyId)));

  if (!alvo) {
    return { ok: false, situacao: 'erro', mensagem: 'Lançamento não encontrado nesta empresa.' };
  }

  const [cat] = await db
    .select({ id: category.id, name: category.name, accountingCode: category.accountingCode })
    .from(category)
    .where(and(eq(category.id, i.categoriaId), eq(category.companyId, i.companyId)));

  if (!cat) {
    return { ok: false, situacao: 'erro', mensagem: 'Categoria não encontrada nesta empresa.' };
  }

  const confianca = await medirConfiancaClassificacao(
    i.companyId,
    alvo.description,
    alvo.partnerId,
    i.categoriaId,
    i.opiniaoModelo,
  );

  return comRun(
    i.companyId,
    'classificador',
    i.trigger ?? 'API',
    i.userId ?? null,
    { lancamentoId: i.lancamentoId, categoriaId: i.categoriaId },
    async (runId) => {
      const acao = await propor(db, {
        companyId: i.companyId,
        agentRunId: runId,
        kind: 'CLASSIFICAR_LANCAMENTO' as ActionKind,
        targetTable: 'financial_entry',
        targetId: alvo.id,
        proposal: {
          categoriaId: cat.id,
          categoriaNome: cat.name,
          contaContabil: cat.accountingCode,
          categoriaAnterior: alvo.categoryIdAtual,
        },
        rationale: i.justificativa,
        confianca,
        amount: Number(alvo.amount),
      });

      if (!acao.podeAplicar) {
        return {
          ok: true,
          situacao: 'aguardando_aprovacao' as const,
          mensagem: `Classificação proposta e aguardando aprovação. ${acao.motivo}`,
          acaoId: acao.id,
          confianca: confianca.score,
          evidencia: confianca.resumo,
        };
      }

      try {
        await db
          .update(financialEntry)
          .set({ categoryId: cat.id })
          .where(
            and(eq(financialEntry.id, alvo.id), eq(financialEntry.companyId, i.companyId)),
          );

        // A conta contábil muda junto com a categoria, então a partida antiga
        // — que apontava para "a classificar" — é estornada e refeita. Sem
        // isto a tela mostraria a categoria nova e o balancete continuaria
        // dizendo a antiga.
        const re = await reescriturarLancamento(
          db,
          i.companyId,
          alvo.id,
          `reclassificado para "${cat.name}" pelo agente`,
          { createdByUserId: i.userId ?? null, agentRunId: runId },
        );
        await marcarAplicada(db, acao.id);

        return {
          ok: true,
          situacao: 'aplicado' as const,
          mensagem:
            `Classificado como "${cat.name}"${cat.accountingCode ? ` (${cat.accountingCode})` : ''}. ` +
            `${re.estornadas} partida(s) estornada(s) e ${re.gravadas} refeita(s) no razão.`,
          acaoId: acao.id,
          confianca: confianca.score,
          evidencia: confianca.resumo,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await marcarFalhada(db, acao.id, msg);
        return { ok: false, situacao: 'erro' as const, mensagem: msg, acaoId: acao.id };
      }
    },
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Conciliar transação bancária
   ══════════════════════════════════════════════════════════════════════════ */

export interface ConciliarInput {
  companyId: string;
  transacaoId: string;
  lancamentoId: string;
  justificativa: string;
  userId?: string | null;
  trigger?: 'CRON' | 'USER' | 'API';
}

/**
 * Casa uma transação do extrato com um lançamento em aberto.
 *
 * A confiança é medida a partir do pareamento em si — diferença de valor, de
 * data, e QUANTOS outros lançamentos têm o mesmo valor. Este último sinal é o
 * que faltava no código anterior, que dava 0,95 fixo: com três aluguéis de
 * R$ 1.500 em aberto, "o valor bate" não distingue nada.
 */
export async function conciliarTransacao(i: ConciliarInput): Promise<ResultadoFerramenta> {
  const db = getDb();

  const [tx] = await db
    .select()
    .from(bankTransaction)
    .where(and(eq(bankTransaction.id, i.transacaoId), eq(bankTransaction.companyId, i.companyId)));
  const [lanc] = await db
    .select()
    .from(financialEntry)
    .where(and(eq(financialEntry.id, i.lancamentoId), eq(financialEntry.companyId, i.companyId)));

  if (!tx || !lanc) {
    return { ok: false, situacao: 'erro', mensagem: 'Transação ou lançamento não encontrado.' };
  }
  if (tx.reconciliationStatus !== 'UNMATCHED') {
    return { ok: false, situacao: 'recusado', mensagem: 'Transação já conciliada ou ignorada.' };
  }

  const valorTx = Math.abs(Number(tx.amount));
  const valorLanc = Number(lanc.amount);
  const tipoEsperado = Number(tx.amount) > 0 ? 'RECEIVABLE' : 'PAYABLE';

  if (lanc.type !== tipoEsperado) {
    return {
      ok: false,
      situacao: 'recusado',
      mensagem: `Tipo divergente: transação é ${tipoEsperado === 'RECEIVABLE' ? 'entrada' : 'saída'} e o lançamento não.`,
    };
  }

  // Quantos outros lançamentos em aberto têm exatamente este valor? É o que
  // transforma "valor bate" de certeza em coincidência.
  const [amb] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM financial_entry
    WHERE company_id = ${i.companyId} AND status = 'PENDING'
      AND type = ${tipoEsperado} AND abs(amount - ${valorTx}) < 0.01
  `)) as unknown as { n: number }[];

  const dias = Math.round(
    (Date.parse(`${tx.postedAt}T00:00:00`) - Date.parse(`${lanc.dueDate}T00:00:00`)) / 86_400_000,
  );

  const confianca = confiancaConciliacao({
    diferencaValor: Math.abs(valorTx - valorLanc),
    diferencaDias: dias,
    candidatosMesmoValor: Number(amb?.n ?? 1),
  });

  return comRun(
    i.companyId,
    'conciliador',
    i.trigger ?? 'API',
    i.userId ?? null,
    { transacaoId: i.transacaoId, lancamentoId: i.lancamentoId },
    async (runId) => {
      const acao = await propor(db, {
        companyId: i.companyId,
        agentRunId: runId,
        kind: 'CONCILIAR_TRANSACAO' as ActionKind,
        targetTable: 'bank_transaction',
        targetId: tx.id,
        proposal: { lancamentoId: lanc.id, descricaoExtrato: tx.description, valor: valorTx },
        rationale: i.justificativa,
        confianca,
        amount: valorTx,
      });

      if (!acao.podeAplicar) {
        return {
          ok: true,
          situacao: 'aguardando_aprovacao' as const,
          mensagem: `Conciliação proposta e aguardando aprovação. ${acao.motivo}`,
          acaoId: acao.id,
          confianca: confianca.score,
          evidencia: confianca.resumo,
        };
      }

      try {
        await db.insert(reconciliationMatch).values({
          companyId: i.companyId,
          bankTransactionId: tx.id,
          financialEntryId: lanc.id,
        });
        await db
          .update(bankTransaction)
          .set({ reconciliationStatus: 'MATCHED' })
          .where(eq(bankTransaction.id, tx.id));
        await db
          .update(financialEntry)
          .set({ status: 'PAID', paidAt: tx.postedAt })
          .where(eq(financialEntry.id, lanc.id));

        await escriturar('lancamento', i.companyId, lanc.id, i.userId);
        await marcarAplicada(db, acao.id);

        return {
          ok: true,
          situacao: 'aplicado' as const,
          mensagem: `Conciliado: "${tx.description}" baixou o lançamento "${lanc.description}".`,
          acaoId: acao.id,
          confianca: confianca.score,
          evidencia: confianca.resumo,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await marcarFalhada(db, acao.id, msg);
        return { ok: false, situacao: 'erro' as const, mensagem: msg, acaoId: acao.id };
      }
    },
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Fila humana
   ══════════════════════════════════════════════════════════════════════════ */

export async function listarFilaAprovacao(companyId: string) {
  return listarPendentesDeAprovacao(getDb(), companyId);
}

export async function listarFilaRevisao(companyId: string) {
  return listarParaRevisao(getDb(), companyId);
}

export async function historicoDoLancamento(companyId: string, lancamentoId: string) {
  return historicoDoDocumento(getDb(), companyId, 'financial_entry', lancamentoId);
}

/**
 * Decide sobre uma ação — e faz a decisão valer no razão.
 *
 * ── O que esta função fazia antes ───────────────────────────────────────
 *
 * Só registrava. Aprovar mudava o status para APPROVED e respondia "será
 * executada na próxima passagem do agente" — passagem que não existia: nada
 * no sistema aplicava ação aprovada. E rejeitar uma classificação que a IA
 * JÁ tinha aplicado marcava REJECTED e tirava o item da fila, com o
 * lançamento ainda na conta errada. O contador dizia "isto está errado", a
 * fila esvaziava, e o balancete continuava dizendo a coisa errada.
 *
 * ── O que faz agora ────────────────────────────────────────────────────
 *
 * - Aprovar uma classificação que esperava aprovação: aplica, na hora.
 * - Rejeitar uma classificação já aplicada: exige a categoria certa e
 *   reclassifica — por estorno, como toda correção no razão.
 * - Qualquer outro tipo: registra, e diz isso com essas palavras.
 */
export async function decidirAcao(
  companyId: string,
  acaoId: string,
  decision: 'APPROVED' | 'REJECTED',
  userId: string | null,
  nota?: string,
  /** Categoria correta, quando a rejeição é de uma classificação. */
  categoriaCorretaId?: string,
): Promise<ResultadoFerramenta> {
  const db = getDb();
  const [acao] = await db
    .select({
      kind: agentAction.kind,
      status: agentAction.status,
      targetId: agentAction.targetId,
      proposal: agentAction.proposal,
    })
    .from(agentAction)
    .where(and(eq(agentAction.id, acaoId), eq(agentAction.companyId, companyId)));

  if (!acao) return { ok: false, situacao: 'erro', mensagem: 'Ação não encontrada nesta empresa.' };

  const ehClassificacao = acao.kind === 'CLASSIFICAR_LANCAMENTO' && Boolean(acao.targetId);
  const proposta = (acao.proposal ?? {}) as { categoriaId?: string; categoriaNome?: string };

  /* ── Rejeitar ou alterar classificação: corrigir, não só anotar ─────── */
  if (ehClassificacao && ((decision === 'REJECTED' && (acao.status === 'APPLIED' || (acao.status === 'AWAITING_APPROVAL' && categoriaCorretaId))) || (acao.status === 'APPLIED' && categoriaCorretaId && categoriaCorretaId !== proposta.categoriaId))) {
    if (!categoriaCorretaId) {
      return {
        ok: false,
        situacao: 'erro',
        mensagem:
          'Diga qual é a categoria certa. Rejeitar sem corrigir deixaria o lançamento na conta ' +
          'errada, com a fila vazia dizendo que está tudo resolvido.',
      };
    }
    const [cat] = await db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(and(eq(category.id, categoriaCorretaId), eq(category.companyId, companyId)));
    if (!cat) return { ok: false, situacao: 'erro', mensagem: 'Categoria não encontrada nesta empresa.' };

    await db
      .update(financialEntry)
      .set({ categoryId: cat.id })
      .where(and(eq(financialEntry.id, acao.targetId!), eq(financialEntry.companyId, companyId)));
    const re = await reescriturarLancamento(
      db,
      companyId,
      acao.targetId!,
      `corrigido de "${proposta.categoriaNome ?? '?'}" para "${cat.name}"${nota ? `: ${nota}` : ''}`,
      { createdByUserId: userId },
    );

    // A nota leva a categoria certa: é o par rotulado que a confiança medida
    // lê da próxima vez — "a IA disse X, o certo era Y".
    await decidir(db, companyId, acaoId, 'REJECTED', userId,
      `[correta: ${cat.name}] ${nota ?? ''}`.trim());

    return {
      ok: true,
      situacao: 'aplicado',
      mensagem:
        `Corrigido para "${cat.name}". ${re.estornadas} partida(s) estornada(s) e ` +
        `${re.gravadas} refeita(s) no razão.`,
      acaoId,
    };
  }

  /* ── Aprovar classificação que esperava: aplicar agora ───────────────── */
  if (decision === 'APPROVED' && ehClassificacao && acao.status === 'AWAITING_APPROVAL') {
    const catIdParaAplicar = categoriaCorretaId || proposta.categoriaId;
    if (!catIdParaAplicar) {
      return { ok: false, situacao: 'erro', mensagem: 'A proposta não diz qual categoria aplicar.' };
    }
    const [cat] = await db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(and(eq(category.id, catIdParaAplicar), eq(category.companyId, companyId)));
    if (!cat) return { ok: false, situacao: 'erro', mensagem: 'Categoria não encontrada nesta empresa.' };

    const nomeCatAplicada = cat.name;
    const notaDecisao = categoriaCorretaId
      ? `[alterada para: ${nomeCatAplicada}] ${nota ?? ''}`.trim()
      : (nota || undefined);

    // A aprovação precisa existir ANTES de aplicar: o trigger do banco recusa
    // aplicar ação de nível APPROVAL sem aprovação registrada.
    await decidir(db, companyId, acaoId, 'APPROVED', userId, notaDecisao);
    try {
      await db
        .update(financialEntry)
        .set({ categoryId: cat.id })
        .where(and(eq(financialEntry.id, acao.targetId!), eq(financialEntry.companyId, companyId)));
      const re = await reescriturarLancamento(
        db, companyId, acao.targetId!,
        `classificado como "${nomeCatAplicada}" — aprovado pelo usuário`,
        { createdByUserId: userId },
      );
      await marcarAplicada(db, acaoId);
      return {
        ok: true,
        situacao: 'aplicado',
        mensagem: `Aprovado e aplicado: "${nomeCatAplicada}". ${re.gravadas} partida(s) no razão.`,
        acaoId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await marcarFalhada(db, acaoId, msg);
      return { ok: false, situacao: 'erro', mensagem: `Aprovado, mas falhou ao aplicar: ${msg}`, acaoId };
    }
  }

  /* ── O resto: registrar, e dizer que é só isso ───────────────────────── */
  await decidir(db, companyId, acaoId, decision, userId, nota);
  return {
    ok: true,
    situacao: decision === 'APPROVED' ? 'aplicado' : 'recusado',
    mensagem:
      decision === 'APPROVED'
        ? 'Decisão registrada na trilha.'
        : 'Rejeição registrada — é ela que ensina o agente da próxima vez.',
    acaoId,
  };
}
