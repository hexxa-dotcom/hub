import { withTenant, sql } from '@hexxa/db';
import { calcularCaixaLivre, type CaixaLivre, type TenantContext } from '@hexxa/core';
import { getSimplesInputs, posicaoSimples } from './fiscal';

/**
 * O "livre para retirar" com os números da empresa.
 *
 * A conta em si é pura e está testada em `calcularCaixaLivre`. Aqui só se
 * busca o que ela pede: os saldos do razão e, quando o mês corrente ainda não
 * foi provisionado, uma estimativa do imposto dele.
 */
export interface CaixaLivreDaEmpresa extends CaixaLivre {
  /** `true` quando o imposto do mês corrente é estimativa, não provisão. */
  impostoDoMesEstimado: boolean;
  /** Mês de referência usado na estimativa (AAAA-MM-01). */
  mesCorrente: string;
}

export async function getCaixaLivre(ctx: TenantContext): Promise<CaixaLivreDaEmpresa> {
  const mesCorrente = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    .slice(0, 7)
    .concat('-01');

  const { saldos, jaProvisionado, receitaDoMes } = await withTenant(ctx.companyId, async (tx) => {
    const [saldosRes, provisaoRes, receitaRes] = await Promise.all([
      /**
       * Saldo de cada conta, com o sinal da natureza dela — devedor no ativo,
       * credor no passivo. Só lançamento POSTED: rascunho e estornado não são
       * dinheiro.
       */
      tx.execute(sql`
        SELECT a.code,
          CASE WHEN a.nature = 'DEBIT'
               THEN COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'), 0)
                  - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0)
               ELSE COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'CREDIT'), 0)
                  - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'DEBIT'), 0)
          END AS balance
        FROM ledger_line l
        JOIN journal_entry j ON j.id = l.journal_entry_id
        JOIN chart_of_account a ON a.id = l.account_id
        WHERE l.company_id = ${ctx.companyId}
          AND j.status = 'POSTED'
          AND (a.code LIKE '1.1.01%' OR a.code LIKE '1.1.09%' OR a.code LIKE '2.1%')
        GROUP BY a.code, a.nature
      `),
      // Já existe provisão de imposto lançada para o mês corrente?
      tx.execute(sql`
        SELECT 1 AS ok
        FROM ledger_line l
        JOIN journal_entry j ON j.id = l.journal_entry_id
        JOIN chart_of_account a ON a.id = l.account_id
        WHERE l.company_id = ${ctx.companyId}
          AND j.status = 'POSTED'
          AND j.reference_month = ${mesCorrente}::date
          AND a.code LIKE '2.1.03%'
        LIMIT 1
      `),
      /**
       * Receita do mês corrente que gera imposto. Só o que tem nota — a mesma
       * regra do RBT12 em `getSimplesInputs`: boleto e entrada de extrato não
       * são faturamento tributável.
       */
      tx.execute(sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND type = 'RECEIVABLE'
          AND status != 'CANCELED'
          AND source IN ('NFSE', 'DFE_SYNC')
          AND reference_month = ${mesCorrente}::date
      `),
    ]);
    return {
      saldos: (saldosRes as unknown as { code: string; balance: string }[]).map((r) => ({
        code: String(r.code),
        balance: Number(r.balance),
      })),
      jaProvisionado: (provisaoRes as unknown as unknown[]).length > 0,
      receitaDoMes: Number(
        (receitaRes as unknown as { total: string }[])[0]?.total ?? 0,
      ),
    };
  });

  /**
   * O imposto do mês que ainda não virou provisão.
   *
   * Sem isto, entre o dia 1º e o fechamento o número sai otimista justamente
   * no período em que o cliente mais olha para ele — e "otimista" aqui
   * significa dizer que ele pode tirar dinheiro que é do Leão.
   *
   * A alíquota vem da posição no Simples, que já sabe usar o anexo APURADO
   * pelo contábil quando existe, em vez de adivinhar pelo Fator R.
   */
  let impostoEstimadoDoMes = 0;
  let impostoDoMesEstimado = false;
  if (!jaProvisionado && receitaDoMes > 0) {
    try {
      const entradas = await getSimplesInputs(ctx);
      const pos = await posicaoSimples(ctx, { rbt12: entradas.rbt12, folha12: entradas.folha12 });
      const aliquota = Number(pos.effectiveRate ?? 0);
      if (aliquota > 0) {
        // `effectiveRate` vem em pontos percentuais (6,54 = 6,54%).
        impostoEstimadoDoMes = Math.round(receitaDoMes * (aliquota / 100) * 100) / 100;
        impostoDoMesEstimado = true;
      }
    } catch {
      // Sem posição fiscal não se inventa imposto: o número sai só com o que
      // o razão conhece, e a tela avisa que o mês ainda não foi provisionado.
    }
  }

  return {
    ...calcularCaixaLivre({ saldos, impostoEstimadoDoMes }),
    impostoDoMesEstimado,
    mesCorrente,
  };
}
