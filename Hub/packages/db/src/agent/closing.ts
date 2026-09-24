import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { verificarFechamento, type DadosDoMes, type ResultadoFechamento } from '@hexxa/core';
import { ACCOUNTS } from '@hexxa/core';
import { escriturarPendentes } from '../ledger/pendentes';
import { iniciarRun, encerrarRun, propor } from './repository';
import { confiancaClassificacao } from '@hexxa/core';

/**
 * AGENTE DE FECHAMENTO.
 *
 * Substitui o `SUM()` que gravava `CLOSED` sem conferir nada.
 *
 * A ordem das etapas importa e não é arbitrária:
 *
 * 1. Escritura o que ficou pendente — não adianta conferir um razão incompleto.
 * 2. Coleta o retrato do mês.
 * 3. Roda as verificações (puras, em `@hexxa/core`).
 * 4. Registra cada ocorrência como ação de agente, com trilha.
 * 5. Propõe FECHAR_MES — que a régua classifica como APPROVAL, sempre.
 *
 * O passo 5 é o ponto: **o agente nunca fecha o mês sozinho.** Fechar declara
 * um período encerrado e vira base do que vai à contabilidade oficial. A régua
 * de autonomia trata isso como irreversível, e ela não se dobra a confiança
 * alta. O agente confere, encontra, explica e propõe. Quem fecha é gente.
 */

/** Coleta o retrato do mês. Uma consulta por pergunta, para serem legíveis. */
export async function coletarDadosDoMes(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
): Promise<DadosDoMes> {
  const [razao] = (await tx.execute(sql`
    SELECT
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'),  0) AS debito,
      COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0) AS credito
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${referenceMonth}::date
  `)) as unknown as Record<string, unknown>[];

  const [classif] = (await tx.execute(sql`
    SELECT
      count(DISTINCT j.source_id)::int AS quantidade,
      COALESCE(SUM(l.amount), 0) AS valor,
      COALESCE(array_agg(DISTINCT j.source_id::text) FILTER (WHERE j.source_id IS NOT NULL), '{}') AS documentos
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED' AND j.reversed_by IS NULL
      AND j.reference_month = ${referenceMonth}::date
      AND l.direction = 'DEBIT'
  `)) as unknown as Record<string, unknown>[];

  const [extrato] = (await tx.execute(sql`
    SELECT count(*)::int AS quantidade, COALESCE(SUM(abs(amount)), 0) AS valor
    FROM bank_transaction
    WHERE company_id = ${companyId}
      AND reconciliation_status = 'UNMATCHED'
      AND date_trunc('month', posted_at) = ${referenceMonth}::date
  `)) as unknown as Record<string, unknown>[];

  const [totais] = (await tx.execute(sql`
    SELECT
      count(*)::int AS total,
      COALESCE(SUM(amount) FILTER (WHERE type = 'RECEIVABLE'), 0) AS receita,
      COALESCE(SUM(amount) FILTER (WHERE type = 'PAYABLE'),    0) AS despesa
    FROM financial_entry
    WHERE company_id = ${companyId}
      AND status <> 'CANCELED'
      AND reference_month = ${referenceMonth}::date
  `)) as unknown as Record<string, unknown>[];

  // Receita sem nota: lançamento a receber cuja origem não é nota e que não
  // tem nota vinculada. É a checagem que mais custa caro quando falta.
  const [semNota] = (await tx.execute(sql`
    SELECT
      count(*)::int AS quantidade,
      COALESCE(SUM(e.amount), 0) AS valor,
      COALESCE(array_agg(e.id::text), '{}') AS documentos
    FROM financial_entry e
    WHERE e.company_id = ${companyId}
      AND e.type = 'RECEIVABLE'
      AND e.status <> 'CANCELED'
      AND e.reference_month = ${referenceMonth}::date
      -- Nota emitida pela Hexx (NFSE) ou trazida do Emissor Nacional
      -- (DFE_SYNC): as duas SÃO nota. Contar a segunda como "sem nota"
      -- travava o fechamento de quem emite fora da Hexx.
      AND e.source NOT IN ('NFSE', 'DFE_SYNC')
      AND NOT EXISTS (
        -- service_invoice não tem data de emissão própria: o mês da nota é
        -- reference_month, como no resto do sistema.
        SELECT 1 FROM service_invoice si
        WHERE si.company_id = e.company_id
          AND si.status = 'ISSUED'
          AND abs(si.amount - e.amount) < 0.01
          AND si.reference_month = ${referenceMonth}::date)
  `)) as unknown as Record<string, unknown>[];

  // Duplicidade: mesmo parceiro, valor e vencimento. Sem parceiro não conta —
  // descrição igual com parceiro nulo é parcela recorrente na esmagadora
  // maioria dos casos, e apontar isso seria ruído.
  const dups = (await tx.execute(sql`
    SELECT
      max(description) AS descricao, amount, count(*)::int AS n,
      array_agg(id::text) AS ids
    FROM financial_entry
    WHERE company_id = ${companyId}
      AND status <> 'CANCELED'
      AND reference_month = ${referenceMonth}::date
      AND partner_id IS NOT NULL
    GROUP BY partner_id, amount, due_date
    HAVING count(*) > 1
    LIMIT 20
  `)) as unknown as Record<string, unknown>[];

  const [guia] = (await tx.execute(sql`
    SELECT count(*)::int AS n FROM tax_guide
    WHERE company_id = ${companyId} AND reference_month = ${referenceMonth}::date
  `)) as unknown as Record<string, unknown>[];

  const [saldoRazao] = (await tx.execute(sql`
    SELECT COALESCE(
      SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0) AS saldo
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reference_month <= ${referenceMonth}::date
      AND a.code IN (${ACCOUNTS.BANCOS}, ${ACCOUNTS.CAIXA})
  `)) as unknown as Record<string, unknown>[];

  // `tem_feed` distingue saldo mantido por extrato de saldo digitado uma vez.
  // Sem essa distinção, a verificação de saldo acusaria divergência contra um
  // campo que ninguém atualiza — e travaria todo fechamento para sempre.
  const [saldoCadastro] = (await tx.execute(sql`
    SELECT
      SUM(b.current_balance) AS saldo,
      count(*)::int AS n,
      bool_or(
        b.open_finance_item_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM bank_transaction t WHERE t.bank_account_id = b.id)
      ) AS tem_feed
    FROM bank_account b WHERE b.company_id = ${companyId}
  `)) as unknown as Record<string, unknown>[];

  /**
   * Saldo da transitória do extrato — o que trava o fechamento.
   *
   * Até a data do fim do mês, e não do mês inteiro: um movimento de setembro
   * não deve impedir o fechamento de agosto.
   */
  const [transitoria] = (await tx.execute(sql`
    SELECT COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)::float AS saldo,
           count(*)::int AS quantidade
      FROM ledger_line l
      JOIN journal_entry j ON j.id = l.journal_entry_id
      JOIN chart_of_account a ON a.id = l.account_id
     WHERE l.company_id = ${companyId}
       AND a.code = '1.1.09.001'
       AND j.status = 'POSTED'
       AND j.reversed_by IS NULL
       AND j.entry_date <= (${referenceMonth}::date + '1 month'::interval - '1 day'::interval)
  `)) as unknown as Record<string, unknown>[];

  const receita = Number(totais?.receita ?? 0);

  return {
    referenceMonth,
    razao: { debito: Number(razao?.debito ?? 0), credito: Number(razao?.credito ?? 0) },
    aClassificar: {
      quantidade: Number(classif?.quantidade ?? 0),
      valor: Number(classif?.valor ?? 0),
      documentos: (classif?.documentos as string[]) ?? [],
    },
    transitoria: {
      saldo: Number(transitoria?.saldo ?? 0),
      quantidade: Number(transitoria?.quantidade ?? 0),
    },
    extratoPendente: {
      quantidade: Number(extrato?.quantidade ?? 0),
      valor: Number(extrato?.valor ?? 0),
    },
    receita,
    receitaComNota: receita - Number(semNota?.valor ?? 0),
    receitaSemNota: {
      quantidade: Number(semNota?.quantidade ?? 0),
      valor: Number(semNota?.valor ?? 0),
      documentos: (semNota?.documentos as string[]) ?? [],
    },
    duplicidades: dups.map((d) => ({
      descricao: String(d.descricao ?? ''),
      valor: Number(d.amount ?? 0),
      ids: (d.ids as string[]) ?? [],
    })),
    temGuiaDoMes: Number(guia?.n ?? 0) > 0,
    saldoBanco: {
      peloRazao: Number(saldoRazao?.saldo ?? 0),
      // Sem conta bancária cadastrada não há com o que comparar — e isso é
      // uma informação, não um zero. Devolver 0 faria a verificação acusar
      // divergência de um saldo que ninguém informou.
      peloCadastro: Number(saldoCadastro?.n ?? 0) > 0 ? Number(saldoCadastro?.saldo ?? 0) : null,
      temFeed: Boolean(saldoCadastro?.tem_feed),
    },
    totalLancamentos: Number(totais?.total ?? 0),
    despesaTotal: Number(totais?.despesa ?? 0),
  };
}

export interface FechamentoAgente extends ResultadoFechamento {
  agentRunId: string;
  /** Ação FECHAR_MES aguardando aprovação, quando o mês pôde ser fechado. */
  acaoFechamentoId?: string;
  escrituradas: number;
}

/**
 * Executa o fechamento conferido de um mês.
 *
 * Não grava `monthly_closure`: a conferência produz um parecer e uma proposta,
 * e o registro do fechamento só acontece quando alguém aprova. Separar as duas
 * coisas é o que impede "o agente rodou" de virar "o mês está fechado".
 */
export async function fecharMesComConferencia(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  opts: { trigger?: 'CRON' | 'USER' | 'API'; userId?: string | null } = {},
): Promise<FechamentoAgente> {
  const runId = await iniciarRun(tx, {
    companyId,
    agent: 'fechamento',
    trigger: opts.trigger ?? 'CRON',
    requestedByUserId: opts.userId ?? null,
    input: { referenceMonth },
  });

  try {
    // 1. Razão em dia antes de conferir — conferir escrituração incompleta
    //    produziria bloqueios que não são do mês, e sim da nossa demora.
    const varredura = await escriturarPendentes(tx, companyId, { agentRunId: runId });

    // 2 e 3. Retrato e verificações.
    const dados = await coletarDadosDoMes(tx, companyId, referenceMonth);
    const resultado = verificarFechamento(dados);

    // 4. Cada ocorrência vira ação registrada, com evidência.
    for (const o of resultado.ocorrencias) {
      await propor(tx, {
        companyId,
        agentRunId: runId,
        // Ocorrência não é mudança a aplicar: é achado. Fica como ação para
        // herdar a trilha — quem viu, quando, com que evidência.
        kind: 'FECHAR_MES',
        targetTable: 'monthly_closure',
        targetId: null,
        proposal: {
          ocorrencia: o.id,
          severidade: o.severidade,
          mes: referenceMonth,
          documentos: o.documentos ?? [],
          acaoSugerida: o.acao,
        },
        rationale: `${o.titulo}: ${o.detalhe}${o.acao ? ` → ${o.acao}` : ''}`,
        // A conferência é determinística: ou o número bate ou não bate. Não há
        // incerteza de modelo aqui, e fingir que há seria ruído.
        confianca: {
          score: 1,
          sinais: [
            {
              nome: 'verificacao_deterministica',
              forca: 1,
              peso: 1,
              observado: o.detalhe,
            },
          ],
          resumo: o.detalhe,
        },
        amount: o.valor ?? null,
      });
    }

    // 5. A proposta de fechar — só quando não há bloqueio.
    let acaoFechamentoId: string | undefined;
    if (resultado.podeFechar) {
      const acao = await propor(tx, {
        companyId,
        agentRunId: runId,
        kind: 'FECHAR_MES',
        targetTable: 'monthly_closure',
        targetId: null,
        proposal: {
          mes: referenceMonth,
          receita: dados.receita,
          despesa: dados.despesaTotal,
          verificacoes: resultado.ocorrencias.length,
        },
        rationale:
          `Mês ${referenceMonth} conferido: razão fecha, ` +
          `${resultado.atencoes.length} ponto(s) de atenção e nenhum bloqueio. ` +
          `Receita ${dados.receita.toFixed(2)}, despesa ${dados.despesaTotal.toFixed(2)}.`,
        confianca: confiancaClassificacao({
          acertosDescricao: 0,
          divergenciasDescricao: 0,
          acertosFornecedor: 0,
          divergenciasFornecedor: 0,
        }),
        amount: dados.receita,
      });
      acaoFechamentoId = acao.id;
    }

    await encerrarRun(tx, runId, { summary: resultado.resumo });

    return {
      ...resultado,
      agentRunId: runId,
      acaoFechamentoId,
      escrituradas: varredura.gravadas,
    };
  } catch (err) {
    await encerrarRun(tx, runId, { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
