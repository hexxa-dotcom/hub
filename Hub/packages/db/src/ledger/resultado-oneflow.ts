import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import type { clienteOneflow } from './oneflow-client';

/**
 * RESULTADO OFICIAL — o lucro que a contabilidade de verdade apurou.
 *
 * ── Por que espelhar em vez de calcular ─────────────────────────────────
 *
 * A Hexx é um sistema de gestão integrado a um sistema contábil. As regras e
 * a conta são do sistema contábil; quando os dois divergem, prevalece o de
 * lá. Para o lucro isso não é preferência, é consequência: a distribuição de
 * lucro isenta ao sócio se apoia no lucro ESCRITURADO, e escriturado é o que
 * está no OneFlow.
 *
 * A conta que existia aqui (receitas menos despesas do financeiro) errava de
 * três jeitos, todos silenciosos: não via DAS nem folha, que vêm do OneFlow e
 * moram em outras tabelas; somava o ano inteiro, inclusive meses futuros; e
 * dava zero para quem tem a receita inteira no OneFlow.
 *
 * ── Só mês ENVIADO ──────────────────────────────────────────────────────
 *
 * O balancete de lá reflete o que chegou lá. Um mês ainda em aberto aqui pode
 * estar pela metade lá. Ler só meses ENVIADOS — liberados pelo contador e
 * inteiros no OneFlow — garante que o número nunca misture conferido com
 * provisório.
 */

export interface ResultadoOficial {
  referenceMonth: string;
  contabilImplantado: boolean;
  receitas: number | null;
  custosDespesas: number | null;
  /** Acumulado no exercício até a competência. Positivo = lucro. */
  resultado: number | null;
  /** Por que o resultado foi recusado, quando foi. */
  motivo: string | null;
  fetchedAt: Date;
}

/**
 * Lê o balancete da competência no OneFlow e grava o resultado.
 *
 * O plano de contas de lá tem 1 Ativo e 2 Passivo (com o PL dentro); do 3 em
 * diante são contas de resultado — receita, custo, despesa. Soma-se só o
 * nível mais alto de cada grupo, com o sinal da natureza (credor soma,
 * devedor subtrai), para não contar a mesma conta duas vezes pelas
 * sintéticas.
 *
 * @param competencia 'AAAAMM'
 */
export async function sincronizarResultado(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
  cliente: ReturnType<typeof clienteOneflow>,
): Promise<ResultadoOficial> {
  const resp = (await cliente.balancete(companyId, appHash, competencia, competencia)) as {
    result?: { balancete?: Record<string, unknown>[]; idPlanoContas?: number };
  };
  const linhas = resp.result?.balancete ?? [];
  const implantado = Boolean(resp.result?.idPlanoContas) && linhas.length > 0;
  const referenceMonth = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`;

  let receitas: number | null = null;
  let custosDespesas: number | null = null;
  let resultado: number | null = null;
  let motivo: string | null = null;

  if (implantado) {
    const conferencia = conferirPlano(linhas);
    if (conferencia) {
      motivo = conferencia;
    } else {
      receitas = 0;
      custosDespesas = 0;
      for (const l of linhas) {
        const classe = String(l.classificacao ?? '');
        // Só o topo de cada grupo ("3", "4", "5"…): as sintéticas abaixo dele
        // já estão dentro do saldo dele.
        if (!/^[3-9]$/.test(classe)) continue;
        const saldo = Number(l.saldoFinal ?? 0);
        if (String(l.saldoFinalDC) === 'C') receitas += saldo;
        else custosDespesas += saldo;
      }
      receitas = Number(receitas.toFixed(2));
      custosDespesas = Number(custosDespesas.toFixed(2));
      resultado = Number((receitas - custosDespesas).toFixed(2));
    }
  }

  await tx.execute(sql`
    INSERT INTO oneflow_resultado
      (company_id, reference_month, contabil_implantado, receitas, custos_despesas, resultado, balancete, motivo, fetched_at)
    VALUES (${companyId}, ${referenceMonth}::date, ${implantado},
            ${receitas === null ? null : receitas.toFixed(2)},
            ${custosDespesas === null ? null : custosDespesas.toFixed(2)},
            ${resultado === null ? null : resultado.toFixed(2)},
            ${JSON.stringify(linhas)}::jsonb, ${motivo}, NOW())
    ON CONFLICT (company_id, reference_month) DO UPDATE SET
      contabil_implantado = EXCLUDED.contabil_implantado,
      receitas = EXCLUDED.receitas,
      custos_despesas = EXCLUDED.custos_despesas,
      resultado = EXCLUDED.resultado,
      balancete = EXCLUDED.balancete,
      motivo = EXCLUDED.motivo,
      fetched_at = NOW()
  `);

  return { referenceMonth, contabilImplantado: implantado, receitas, custosDespesas, resultado, motivo, fetchedAt: new Date() };
}

/**
 * O plano de contas de lá é o que este arquivo supõe? Devolve o problema, ou
 * nulo se está tudo certo.
 *
 * A soma do resultado assume 1 = Ativo, 2 = Passivo (com o PL dentro) e do 3
 * em diante só contas de resultado. O plano é POR EMPRESA no OneFlow, e a
 * suposição pode não valer para todas. Errar aqui não dá erro: dá um lucro
 * com o capital social dentro, e uma distribuição acima do permitido. Por
 * isso, na dúvida, recusa.
 *
 * Três conferências:
 * - os grupos 1 e 2 se chamam o que se espera;
 * - nenhum grupo de resultado tem nome de patrimônio, e todos têm nome de
 *   resultado (receita, custo, despesa, dedução, apuração);
 * - o balancete fecha: débitos iguais a créditos nos saldos do topo. Um
 *   balancete que não fecha não serve de base para nada.
 */
export function conferirPlano(linhas: Record<string, unknown>[]): string | null {
  const topo = linhas.filter((l) => /^\d$/.test(String(l.classificacao ?? '')));
  const nome = (c: string) =>
    String(topo.find((l) => String(l.classificacao) === c)?.descricaoConta ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (!/ativo/.test(nome('1'))) return `Grupo 1 do plano é "${nome('1')}", esperado Ativo.`;
  if (!/passivo/.test(nome('2'))) return `Grupo 2 do plano é "${nome('2')}", esperado Passivo.`;

  for (const l of topo) {
    const c = String(l.classificacao);
    if (Number(c) < 3) continue;
    const n = nome(c);
    if (/patrimon|capital|reserva/.test(n)) {
      return `Grupo ${c} do plano ("${n}") parece patrimônio líquido — não pode entrar no resultado.`;
    }
    if (!/receit|custo|despes|dedu|apura|resultad|venda|servic/.test(n)) {
      return `Grupo ${c} do plano ("${n}") não é reconhecido como conta de resultado.`;
    }
  }

  let saldo = 0;
  for (const l of topo) {
    const v = Number(l.saldoFinal ?? 0);
    if (!Number.isFinite(v)) return `Saldo ilegível no grupo ${String(l.classificacao)}.`;
    saldo += String(l.saldoFinalDC) === 'D' ? v : -v;
  }
  if (Math.abs(saldo) > 0.05) {
    return `O balancete de lá não fecha: diferença de ${saldo.toFixed(2)} entre débitos e créditos.`;
  }
  return null;
}

/**
 * Meses que precisam de leitura: ENVIADOS e ainda não lidos depois do envio.
 *
 * Um mês lido depois de enviado não muda sozinho lá — só muda se algo for
 * enviado de novo (um estorno, uma reclassificação), e aí `sent_at` avança.
 * Por isso a comparação é com `sent_at`: dia sem mudança não gasta chamada.
 */
export async function mesesParaSincronizar(
  tx: DbHandle,
  companyId: string,
): Promise<string[]> {
  const r = (await tx.execute(sql`
    SELECT to_char(mc.reference_month, 'YYYYMM') AS comp
      FROM monthly_closure mc
      LEFT JOIN oneflow_resultado r
        ON r.company_id = mc.company_id AND r.reference_month = mc.reference_month
     WHERE mc.company_id = ${companyId}
       AND mc.stage = 'ENVIADO'
       AND (r.fetched_at IS NULL OR r.fetched_at < mc.sent_at)
     ORDER BY mc.reference_month DESC
     LIMIT 1
  `)) as unknown as { comp: string }[];
  return r.map((x) => x.comp);
}

/**
 * O resultado oficial mais recente — o do último mês enviado.
 *
 * `null` quando não há nenhum mês enviado com leitura feita. É uma resposta
 * legítima, e quem chama precisa dizer isso ao usuário em vez de trocar por
 * outra conta: um lucro inventado é pior que nenhum.
 */
export async function resultadoOficial(
  tx: DbHandle,
  companyId: string,
): Promise<ResultadoOficial | null> {
  const [r] = (await tx.execute(sql`
    SELECT to_char(r.reference_month, 'YYYY-MM-DD') AS reference_month, r.contabil_implantado,
           r.receitas, r.custos_despesas, r.resultado, r.motivo, r.fetched_at
      FROM oneflow_resultado r
      JOIN monthly_closure mc
        ON mc.company_id = r.company_id AND mc.reference_month = r.reference_month
       AND mc.stage = 'ENVIADO'
     WHERE r.company_id = ${companyId}
     ORDER BY r.reference_month DESC
     LIMIT 1
  `)) as unknown as Record<string, unknown>[];
  if (!r) return null;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    referenceMonth: String(r.reference_month),
    contabilImplantado: Boolean(r.contabil_implantado),
    receitas: n(r.receitas),
    custosDespesas: n(r.custos_despesas),
    resultado: n(r.resultado),
    motivo: (r.motivo as string) ?? null,
    fetchedAt: r.fetched_at as Date,
  };
}
