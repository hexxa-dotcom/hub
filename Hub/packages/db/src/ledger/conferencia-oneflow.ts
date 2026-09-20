import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { traduzirConta, DE_PARA_ONEFLOW } from '@hexxa/core';
import { clienteOneflow } from './oneflow-client';

/**
 * CONFERÊNCIA: balancete do Hub × balancete do OneFlow.
 *
 * É o que prova que a integração está certa. Enviar sem conferir seria trocar
 * uma escrituração não verificada por outra — o mesmo erro do `SUM()` que o
 * fechamento antigo fazia, só que num sistema a mais.
 *
 * A comparação soma as CONTAS FILHAS de cada destino. O OneFlow tem contas
 * "por participante" (banco, cliente) em que ele cria uma analítica por
 * participante e lança nela, não na sintética que mandamos. Comparar só a
 * sintética acusaria divergência onde não há — foi o que aconteceu na
 * primeira conferência, com o banco aparecendo zerado do lado deles.
 */

export interface LinhaConferencia {
  conta: string;
  descricao: string;
  hubDebito: number;
  hubCredito: number;
  oneflowDebito: number;
  oneflowCredito: number;
  bate: boolean;
  diferenca: number;
}

export interface Conferencia {
  linhas: LinhaConferencia[];
  bate: boolean;
  /** Partidas que o Hub registrou como enviadas. */
  enviadas: number;
  naoEnviadas: number;
}

export interface LinhaBalanceteOneflow {
  classificacao: string;
  descricaoConta?: string;
  debito: number | string;
  credito: number | string;
}

/**
 * Compara o razão enviado com o balancete devolvido pelo OneFlow.
 *
 * Só considera partidas marcadas como ENVIADAS: o que não foi mandado não
 * deveria estar lá, e cobrá-lo do OneFlow acusaria diferença que é nossa.
 */
export async function conferirContraOneflow(
  tx: DbHandle,
  companyId: string,
  balanceteOneflow: LinhaBalanceteOneflow[],
): Promise<Conferencia> {
  const [contagem] = (await tx.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'ENVIADO')::int AS enviadas,
      count(*) FILTER (WHERE status = 'ERRO')::int    AS erro
    FROM oneflow_envio WHERE company_id = ${companyId}
  `)) as unknown as { enviadas: number; erro: number }[];

  const doHub = (await tx.execute(sql`
    SELECT a.code,
      SUM(CASE WHEN l.direction = 'DEBIT'  THEN l.amount ELSE 0 END) AS d,
      SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE 0 END) AS c
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    JOIN oneflow_envio e ON e.journal_entry_id = j.id AND e.status = 'ENVIADO'
    WHERE l.company_id = ${companyId}
    GROUP BY a.code
  `)) as unknown as { code: string; d: string; c: string }[];

  // Agrega pelo destino: várias contas do Hub podem cair na mesma do OneFlow.
  const porDestino = new Map<string, { d: number; c: number }>();
  for (const h of doHub) {
    const dest = traduzirConta(h.code);
    if (!dest) continue;
    const at = porDestino.get(dest.classificacao) ?? { d: 0, c: 0 };
    at.d += Number(h.d);
    at.c += Number(h.c);
    porDestino.set(dest.classificacao, at);
  }

  const linhas: LinhaConferencia[] = [];
  for (const [conta, hub] of porDestino) {
    /**
     * Onde o OneFlow guarda o valor desta conta.
     *
     * Três casos, e os três precisam ser cobertos:
     *
     * 1. A conta existe no balancete com as filhas — soma só as folhas, senão
     *    sintética e analítica contam duas vezes.
     * 2. A conta existe sozinha — usa ela.
     * 3. **A conta NÃO aparece** — o OneFlow consolidou num nível acima. É o
     *    caso do banco: mandamos em `1.1.1.02` e ele agrega em `1.1.1
     *    Disponível`. Sem subir na hierarquia, a conferência acusaria
     *    divergência de R$ 33 mil onde o dinheiro está certo, e alguém
     *    passaria horas procurando um erro que não existe.
     */
    let ofD = 0, ofC = 0, descricao = '';
    const proprias = balanceteOneflow.filter((l) => {
      const cls = String(l.classificacao);
      return cls === conta || cls.startsWith(`${conta}.`);
    });

    if (proprias.length) {
      for (const l of proprias) {
        const cls = String(l.classificacao);
        const temFilha = balanceteOneflow.some((x) => String(x.classificacao).startsWith(`${cls}.`));
        if (temFilha) { if (cls === conta) descricao = String(l.descricaoConta ?? ''); continue; }
        ofD += Number(l.debito);
        ofC += Number(l.credito);
        if (!descricao) descricao = String(l.descricaoConta ?? '');
      }
    } else {
      // Sobe até achar o ancestral que o OneFlow usou para consolidar.
      const partes = conta.split('.');
      for (let i = partes.length - 1; i >= 1; i--) {
        const pai = partes.slice(0, i).join('.');
        const linha = balanceteOneflow.find((l) => String(l.classificacao) === pai);
        if (linha) {
          ofD = Number(linha.debito);
          ofC = Number(linha.credito);
          descricao = `${String(linha.descricaoConta ?? '')} (consolidado em ${pai})`;
          break;
        }
      }
    }

    const dif = Math.round((hub.d - hub.c - (ofD - ofC)) * 100) / 100;
    linhas.push({
      conta,
      descricao,
      hubDebito: Math.round(hub.d * 100) / 100,
      hubCredito: Math.round(hub.c * 100) / 100,
      oneflowDebito: Math.round(ofD * 100) / 100,
      oneflowCredito: Math.round(ofC * 100) / 100,
      bate: dif === 0,
      diferenca: dif,
    });
  }

  linhas.sort((a, b) => a.conta.localeCompare(b.conta));

  return {
    linhas,
    bate: linhas.every((l) => l.bate),
    enviadas: Number(contagem?.enviadas ?? 0),
    naoEnviadas: Number(contagem?.erro ?? 0),
  };
}

export interface ConferenciaDoPlano {
  /** Modelo de plano que a empresa usa no OneFlow ('Dinâmico', 'Padrão'…). */
  modelo: string | null;
  /**
   * `idPlanoContas` que o balancete devolve. **Informativo apenas.**
   *
   * Não decide nada: em 2026-09-20 a BM3 devolveu um id e a Nathalia devolveu
   * `0`, ambas com o plano dinâmico completo e 33/33. Aparentemente só vem
   * preenchido quando a competência consultada tem movimento. Quem responde
   * se a empresa está pronta é a lista de contas.
   */
  planoVinculado: number;
  contasNoOneflow: number;
  /** Destinos do de-para que EXISTEM no plano dela. */
  encontrados: number;
  /** Destinos que não existem — cada um é uma partida que seria recusada. */
  faltando: { classificacao: string; contasDoHub: string[] }[];
  /** `true` só quando todo destino do de-para existe no plano da empresa. */
  pronta: boolean;
}

/**
 * O plano de contas desta empresa no OneFlow aceita o nosso de-para?
 *
 * ── Por que isto existe ─────────────────────────────────────────────────
 *
 * O de-para é um mapa único, escrito contra o "Plano de Contas Dinâmico
 * OneFlow". O OneFlow também oferece um plano PADRÃO, com outra numeração a
 * partir do terceiro nível: nele, das 33 contas do mapa, ZERO existem.
 *
 * Sem esta conferência, isso só apareceria no envio — como uma recusa por
 * partida, ou, pior, silenciosamente, se algum código existisse lá por
 * coincidência e apontasse para outra conta. Foi o caso da BM3, descoberto
 * à mão.
 *
 * Custa uma chamada por página do plano (≈4 no dinâmico). Roda uma vez por
 * empresa, antes de ligar o envio — não a cada envio.
 */
export async function conferirPlanoDoOneflow(
  tx: DbHandle,
  companyId: string,
  appHash: string,
): Promise<ConferenciaDoPlano> {
  const of = clienteOneflow(tx);

  // Só para o diagnóstico. Não entra no veredito — ver `planoVinculado` na
  // interface. Um 504 aqui não pode derrubar a conferência inteira.
  const planoVinculado = await of.planoVinculado(companyId, appHash).catch(() => 0);

  const classificacoes = new Set<string>();
  let contas = 0;
  let modelo: string | null = null;
  for (let pagina = 1; pagina <= 30; pagina++) {
    const lote = await of.planoDeContas(companyId, appHash, pagina);
    if (!lote.length) break;
    for (const c of lote) {
      classificacoes.add(c.classificacao);
      contas++;
      modelo ??= (c as unknown as { nomeModelo?: string }).nomeModelo ?? null;
    }
  }

  // Um destino pode servir a várias contas do Hub — dizer quais ajuda a
  // entender o tamanho do estrago antes de enviar.
  const porDestino = new Map<string, string[]>();
  for (const [contaDoHub, destino] of Object.entries(DE_PARA_ONEFLOW)) {
    const lista = porDestino.get(destino.classificacao) ?? [];
    lista.push(contaDoHub);
    porDestino.set(destino.classificacao, lista);
  }

  const faltando = [...porDestino.entries()]
    .filter(([classificacao]) => !classificacoes.has(classificacao))
    .map(([classificacao, contasDoHub]) => ({ classificacao, contasDoHub }));

  return {
    modelo,
    planoVinculado,
    contasNoOneflow: contas,
    encontrados: porDestino.size - faltando.length,
    faltando,
    pronta: contas > 0 && faltando.length === 0,
  };
}
