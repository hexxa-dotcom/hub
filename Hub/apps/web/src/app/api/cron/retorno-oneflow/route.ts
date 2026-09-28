import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db';
import {
  importarDoOneflow,
  importarSoFolha,
  lerCompetencia,
  marcarLeituraCompleta,
  cotaDiariaEsgotada,
  guiaDisponivel,
  cotaParaRotina,
  appHashPorCnpj,
  assertLedgerBalances,
  empresasComAgenteLigado,
} from '@hexxa/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * MÃO DE VOLTA DO ONEFLOW — traz guia apurada e folha, e escritura.
 *
 * ── Por que DIÁRIO, e não num dia fixo ──────────────────────────────────
 *
 * A primeira versão rodava uma vez, no dia 10. Os dados desmentiram a
 * escolha. Datas reais de geração da guia do DAS, duas empresas, cinco
 * competências:
 *
 *   BM3       dias 1, 1, 3, 3, 1
 *   ESTÚDIO   dias 1, 1, 3, 12, 15
 *
 * Quem gera é o OneFlow, no ritmo dele. Um tiro único no dia 5 perderia duas
 * guias do Estúdio; no dia 10, perderia uma; e em qualquer dia fixo, a guia
 * que saiu antes fica esperando à toa.
 *
 * Rodando todo dia, cada guia chega ao cliente no dia seguinte ao de existir.
 * Para a maioria isso é dia 2 — melhor que qualquer data fixa — e para as
 * atrasadas é o mais cedo possível, porque antes disso não havia o que pegar.
 *
 * ── E por que isso é barato ─────────────────────────────────────────────
 *
 * Empresa cuja guia já chegou é pulada sem gastar chamada nenhuma: a
 * verificação é uma consulta ao banco. O custo diário é de duas chamadas por
 * empresa que ainda falta, e ele cai a zero conforme o mês se completa.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const url = new URL(request.url);
    const competencia = url.searchParams.get('competencia') ?? mesAnterior();
    /**
     * A competência de antes da anterior continua sendo olhada até o dia 20
     * — o vencimento das guias —, mas só onde algo ficou faltando: é o caso
     * da folha que fecha depois do DAS e cuja guia sai no mês seguinte.
     */
    const retrasada = !url.searchParams.get('competencia') && diaSP() <= 20 ? mesAntes(competencia) : null;

    const ligadas = await empresasComAgenteLigado(db, 'retornoOneflow');
    const relatorio: Record<string, unknown>[] = [];
    let interrompido: string | null = null;
    let sondagens = 0;

    /**
     * A volta roda PRIMEIRO e sem reserva: ela tem hora certa e adiá-la
     * atrasa a guia do cliente. O envio do razão roda depois, com o que
     * sobrar, porque ele retoma no dia seguinte sem prejuízo nenhum.
     */
    let orcamento = await cotaParaRotina(db, 'retorno');

    /**
     * O relógio limita antes da cota.
     *
     * Com 1,1s entre chamadas, os 300s de `maxDuration` cabem ~272 chamadas.
     * Parar pelo prazo evita ser morto no meio de uma importação, o que
     * deixaria uma guia gravada sem o PDF e um razão pela metade.
     */
    const prazo = Date.now() + 300_000 - 40_000;

    for (const empresa of ligadas) {
      const [dados] = (await db.execute(sql`
        SELECT cnpj, tax_regime AS regime FROM company WHERE id = ${empresa.id}
      `)) as unknown as { cnpj: string; regime: string | null }[];
      if (!dados) continue;

      /**
       * O que falta desta competência? O fiscal (DAS e guias da apuração) e a
       * folha (recibos e guias DCTFWeb/FGTS) têm marcação própria — a
       * primeira guia que chega não encerra mais o mês, como antes.
       */
      const alvos: { comp: string; fiscal: boolean; folha: boolean; leituraCompletaEm: Date | null }[] = [];
      for (const comp of [competencia, ...(retrasada ? [retrasada] : [])]) {
        const m = await lerCompetencia(db, empresa.id, comp);
        if (comp === retrasada && !m) continue; // a retrasada só se já começou e ficou faltando
        if (m?.fiscalOk && m.folhaOk) continue;
        alvos.push({ comp, fiscal: !m?.fiscalOk, folha: !m?.folhaOk, leituraCompletaEm: m?.leituraCompletaEm ?? null });
      }
      if (!alvos.length) continue;

      const appHash = await appHashPorCnpj(db, dados.cnpj, empresa.id);
      if (!appHash) {
        relatorio.push({ empresa: empresa.nome, erro: 'não cadastrada no OneFlow' });
        continue;
      }

      let parar = false;
      for (const alvo of alvos) {
        if (orcamento <= 0) {
          interrompido = `${empresa.nome} (cota)`;
          parar = true;
          break;
        }
        if (Date.now() > prazo) {
          interrompido = `${empresa.nome} (tempo)`;
          parar = true;
          break;
        }

        let r;
        if (alvo.fiscal) {
          /**
           * Sondagem barata antes de gastar a importação inteira (~6
           * chamadas): 1 chamada responde se a guia do Simples já existe.
           */
          sondagens++;
          orcamento -= 1;
          const codigo = dados.regime === 'MEI' ? 'GMEIGUIA' : 'GPGDAS';
          if (!(await guiaDisponivel(db, empresa.id, appHash, alvo.comp, codigo))) {
            /**
             * Sem guia ainda. Empresa sem faturamento no mês NUNCA terá DAS —
             * só a apuração (zerada) encerra o fiscal dela. A partir do dia 10,
             * lê a apuração inteira, no máximo a cada 5 dias; antes disso a
             * sondagem basta (a maioria das guias sai entre os dias 1 e 3).
             */
            const ultima = alvo.leituraCompletaEm ? new Date(alvo.leituraCompletaEm).getTime() : 0;
            if (diaSP() < 10 || Date.now() - ultima < 5 * 86_400_000) continue;
            await marcarLeituraCompleta(db, empresa.id, alvo.comp);
          }
          r = await importarDoOneflow(db, empresa.id, appHash, alvo.comp);
        } else {
          // Fiscal já voltou; só a folha falta: 1 chamada de status, e o resto só se ela fechou.
          r = await importarSoFolha(db, empresa.id, appHash, alvo.comp);
        }
        orcamento = await cotaParaRotina(db, 'retorno');

        // Conferir depois de escrever. Vale aqui ainda mais que na escrituração
        // comum: o valor veio de fora, e um razão que ninguém verifica é só uma
        // soma com mais tabelas.
        const equilibrio = await assertLedgerBalances(db, empresa.id, '2999-12-01');

        relatorio.push({
          empresa: empresa.nome,
          competencia: alvo.comp,
          guias: r.guias.filter((g) => g.acao === 'criada' || g.acao === 'atualizada'),
          folha: r.folha,
          fatorR: r.fatorR,
          escrituradas: r.escrituradas,
          avisos: r.avisos,
          razaoFecha: equilibrio.ok,
          ...(equilibrio.ok ? {} : { diferenca: equilibrio.diff }),
        });

        if (!equilibrio.ok) {
          console.error(
            `[cron/retorno-oneflow] RAZÃO NÃO FECHA para ${empresa.nome}: diferença ${equilibrio.diff}.`,
          );
        }

        /**
         * Cota diária estourada para o lote inteiro.
         *
         * Seguir para a próxima empresa produziria uma lista de erros idênticos
         * e ainda consumiria a cota de amanhã, porque as tentativas continuam
         * contando. Parar preserva o que já foi importado e deixa o resto para
         * a próxima execução.
         */
        if (cotaDiariaEsgotada(r)) {
          interrompido = empresa.nome;
          parar = true;
          break;
        }
      }
      if (parar) break;
    }

    return NextResponse.json({
      message: interrompido
        ? `Interrompido em "${interrompido}": cota diária da API do OneFlow esgotada. ` +
          'Ela reinicia à meia-noite; as empresas restantes entram na próxima execução.'
        : `Volta concluída para ${relatorio.length} empresa(s), competência ${competencia}.`,
      competencia,
      sondagens,
      cotaRestante: orcamento,
      empresas: relatorio,
    });
  } catch (error) {
    console.error('[cron/retorno-oneflow] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** Dia do mês em São Paulo. */
function diaSP(): number {
  return Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(8, 10));
}

/** A competência AAAAMM anterior a esta. */
function mesAntes(comp: string): string {
  const d = new Date(Date.UTC(Number(comp.slice(0, 4)), Number(comp.slice(4, 6)) - 2, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Competência AAAAMM do mês anterior ao de hoje. */
function mesAnterior(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
