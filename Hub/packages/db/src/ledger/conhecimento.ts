import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';

/**
 * A BASE DE CONHECIMENTO — o que o sistema já sabe sobre cada movimento.
 *
 * Antes de qualquer modelo pensar, pergunta-se aqui: "este fornecedor, este
 * cliente, esta descrição de extrato já foram identificados?". A resposta vem
 * de quem ensinou — contador, empresário, IA verificada ou um lançamento que
 * já casou — e vale mais quanto mais alto for quem ensinou.
 *
 * Duas chaves, nesta ordem:
 *
 * - CNPJ: quando a descrição do extrato traz um (PIX e TED costumam trazer),
 *   é a identificação mais firme que existe — o mesmo CNPJ é a mesma empresa.
 * - DESCRIÇÃO normalizada: o miolo que se repete todo mês, sem data, número de
 *   documento nem "PIX ENVIADO".
 *
 * E dois alcances: o da empresa primeiro, o geral (company_id NULL) depois.
 */

export type OrigemDoConhecimento = 'CONTADOR' | 'EMPRESARIO' | 'IA_VERIFICADA' | 'LANCAMENTO';

/** Quem ensinou pesa: o contador corrige o empresário, que corrige a IA. */
const PRIORIDADE: Record<OrigemDoConhecimento, number> = {
  CONTADOR: 4,
  EMPRESARIO: 3,
  IA_VERIFICADA: 2,
  LANCAMENTO: 1,
};

/** Reduz a descrição ao miolo que se repete entre meses. */
export function normalizarDescricao(d: string): string {
  return d
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    // Números de documento, parcela e data mudam a cada mês e atrapalham.
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(pix|ted|doc|pagamento|pagto|pgto|transferencia|transf|debito|credito|enviado|recebido|compra|cartao)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** O CNPJ que a descrição traz, só dígitos — com ou sem pontuação. */
export function cnpjDaDescricao(d: string): string | null {
  const m = d.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/);
  if (!m) return null;
  const digitos = m[1]!.replace(/\D/g, '');
  return digitos.length === 14 ? digitos : null;
}

export interface Conhecido {
  conta: string;
  nome: string | null;
  origem: OrigemDoConhecimento;
  confirmacoes: number;
  geral: boolean;
}

/**
 * O que a base sabe sobre um movimento, ou null.
 *
 * Só devolve o que foi ENSINADO por alguém ou verificado — não chuta por
 * semelhança fraca: descrição com menos de 4 letras úteis não entra.
 */
export async function consultarConhecimento(
  tx: DbHandle,
  companyId: string,
  descricao: string,
  valor: number,
): Promise<Conhecido | null> {
  const sentido = valor < 0 ? 'SAIDA' : 'ENTRADA';
  const cnpj = cnpjDaDescricao(descricao);
  const chave = normalizarDescricao(descricao);
  if (!cnpj && chave.length < 4) return null;

  const [achado] = (await tx.execute(sql`
    SELECT conta_contabil AS conta, categoria_nome AS nome, origem, confirmacoes, company_id IS NULL AS geral
      FROM conhecimento
     WHERE sentido = ${sentido}
       AND (company_id = ${companyId} OR company_id IS NULL)
       AND (
         (tipo = 'CNPJ' AND chave = ${cnpj ?? '-'})
         OR (tipo = 'DESCRICAO' AND (chave = ${chave} OR (length(chave) >= 6 AND ${chave} LIKE '%' || chave || '%')))
       )
     ORDER BY (tipo = 'CNPJ') DESC,          -- CNPJ vence descrição
              (company_id IS NOT NULL) DESC,  -- o da empresa vence o geral
              CASE origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END DESC,
              length(chave) DESC,
              confirmacoes DESC
     LIMIT 1
  `)) as unknown as Conhecido[];

  return achado ?? null;
}

/**
 * Ensina a base. Grava pela descrição e, se houver, pelo CNPJ.
 *
 * - Mesma conta: soma uma confirmação e sobe a origem, se quem ensinou agora
 *   pesa mais.
 * - Conta diferente: só troca se quem ensina pesa igual ou mais — a IA não
 *   desfaz o que o contador ensinou; o contador desfaz o que a IA fez.
 */
export async function aprender(
  tx: DbHandle,
  companyId: string,
  p: { descricao: string; valor: number; conta: string; categoriaNome?: string | null; origem: OrigemDoConhecimento },
): Promise<void> {
  const sentido = p.valor < 0 ? 'SAIDA' : 'ENTRADA';
  const chaves: { tipo: 'CNPJ' | 'DESCRICAO'; chave: string }[] = [];
  const cnpj = cnpjDaDescricao(p.descricao);
  if (cnpj) chaves.push({ tipo: 'CNPJ', chave: cnpj });
  const desc = normalizarDescricao(p.descricao);
  if (desc.length >= 4) chaves.push({ tipo: 'DESCRICAO', chave: desc });
  const peso = PRIORIDADE[p.origem];

  for (const k of chaves) {
    await tx.execute(sql`
      INSERT INTO conhecimento (company_id, tipo, chave, sentido, conta_contabil, categoria_nome, origem, exemplo)
      VALUES (${companyId}, ${k.tipo}, ${k.chave}, ${sentido}, ${p.conta}, ${p.categoriaNome ?? null}, ${p.origem}, ${p.descricao.slice(0, 120)})
      ON CONFLICT (company_id, tipo, chave, sentido) DO UPDATE SET
        conta_contabil = CASE
          WHEN conhecimento.conta_contabil = EXCLUDED.conta_contabil THEN conhecimento.conta_contabil
          WHEN ${peso} >= CASE conhecimento.origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END
            THEN EXCLUDED.conta_contabil
          ELSE conhecimento.conta_contabil END,
        categoria_nome = CASE
          WHEN conhecimento.conta_contabil = EXCLUDED.conta_contabil
            OR ${peso} >= CASE conhecimento.origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END
            THEN coalesce(EXCLUDED.categoria_nome, conhecimento.categoria_nome)
          ELSE conhecimento.categoria_nome END,
        confirmacoes = CASE
          WHEN conhecimento.conta_contabil = EXCLUDED.conta_contabil THEN conhecimento.confirmacoes + 1
          WHEN ${peso} >= CASE conhecimento.origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END THEN 1
          ELSE conhecimento.confirmacoes END,
        origem = CASE
          WHEN ${peso} >= CASE conhecimento.origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END
            THEN EXCLUDED.origem
          ELSE conhecimento.origem END,
        atualizado_em = now()
    `);
  }
}

/** Alguns exemplos do que a empresa já ensinou — vão para o modelo como referência. */
export async function exemplosDoConhecimento(
  tx: DbHandle,
  companyId: string,
  limite = 40,
): Promise<{ exemplo: string; sentido: string; conta: string; nome: string | null; origem: string }[]> {
  return (await tx.execute(sql`
    SELECT coalesce(exemplo, chave) AS exemplo, sentido, conta_contabil AS conta, categoria_nome AS nome, origem
      FROM conhecimento
     WHERE company_id = ${companyId} OR company_id IS NULL
     ORDER BY CASE origem WHEN 'CONTADOR' THEN 4 WHEN 'EMPRESARIO' THEN 3 WHEN 'IA_VERIFICADA' THEN 2 ELSE 1 END DESC,
              confirmacoes DESC, atualizado_em DESC
     LIMIT ${String(limite)}
  `)) as unknown as { exemplo: string; sentido: string; conta: string; nome: string | null; origem: string }[];
}
