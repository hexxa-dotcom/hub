import { getDb } from '@hexxa/db';
import { autorOuNulo } from './tenant';
import {
  escriturarLancamento,
  escriturarGuia,
  escriturarDistribuicao,
  escriturarPendentes,
  type EscrituracaoResult,
} from '@hexxa/db';

/**
 * GANCHO DE ESCRITURAÇÃO — chamado pelas ações que criam ou liquidam
 * documentos, para que o razão reflita o fato no mesmo instante.
 *
 * Duas decisões desenhadas juntas:
 *
 * 1. **Nunca derruba a ação do usuário.** Registrar uma despesa é a intenção
 *    principal; a partida é consequência. Se a regra contábil falhar, o
 *    lançamento financeiro ainda tem de ser salvo — o contrário treinaria o
 *    usuário a achar o sistema quebrado por um motivo que ele não controla.
 *
 * 2. **A falha não se perde.** Ela é logada e, mais importante, o documento
 *    continua aparecendo na varredura de pendências
 *    (`escriturarPendentes`), que roda por cron e reescritura o que ficou
 *    para trás. É por isso que engolir o erro aqui é seguro: existe um
 *    segundo mecanismo que não depende deste ter funcionado.
 *
 * Sem o item 2, o item 1 seria perda silenciosa de escrituração.
 */

type Alvo = 'lancamento' | 'guia' | 'distribuicao';

const ESCRITURADORES = {
  lancamento: escriturarLancamento,
  guia: escriturarGuia,
  distribuicao: escriturarDistribuicao,
} as const;

/**
 * Escritura um documento sem propagar falha. Chame depois de criar e de novo
 * depois de liquidar — a segunda chamada só acrescenta a baixa, porque o
 * reconhecimento já ocupa a chave de idempotência.
 */
export async function escriturar(
  alvo: Alvo,
  companyId: string,
  documentoId: string,
  userId?: string | null,
): Promise<EscrituracaoResult | null> {
  try {
    const r = await ESCRITURADORES[alvo](getDb(), companyId, documentoId, {
      createdByUserId: autorOuNulo(userId),
    });

    if (r.erros.length) {
      console.error(
        `[ledger] ${alvo}/${documentoId}: ${r.erros.length} partida(s) não gravada(s) — ` +
          `a varredura de pendências tentará de novo.`,
        r.erros,
      );
    }
    return r;
  } catch (err) {
    // Log e segue: o documento fica pendente e a varredura o pega.
    console.error(`[ledger] falha ao escriturar ${alvo}/${documentoId}:`, err);
    return null;
  }
}

/**
 * Varredura direcionada a uma empresa — escritura tudo que ainda não virou
 * partida.
 *
 * Serve aos pontos de escrita que criam vários documentos de uma vez (parcelas
 * de um lançamento, folha do mês inteiro) e não têm um id único para
 * enganchar. Também é o que roda por cron para cobrir os pontos de escrita que
 * ninguém enganchou.
 */
export async function escriturarNovos(companyId: string, userId?: string | null) {
  try {
    const r = await escriturarPendentes(getDb(), companyId, { createdByUserId: autorOuNulo(userId) });
    if (r.erros.length) {
      console.error(`[ledger] varredura de ${companyId}: ${r.erros.length} erro(s)`, r.erros.slice(0, 5));
    }
    return r;
  } catch (err) {
    console.error(`[ledger] varredura de ${companyId} falhou:`, err);
    return null;
  }
}
