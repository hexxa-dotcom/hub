import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import {
  getDb,
  enviarRazao,
  clienteOneflow,
  appHashPorCnpj,
  cotaRestante,
  empresasComAgenteLigado,
  concluirEnviados,
} from '@hexxa/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * ENVIO CONTÍNUO DO RAZÃO AO ONEFLOW.
 *
 * ── Só sai o que o contador liberou ─────────────────────────────────────
 *
 * A primeira versão era contínua: todo dia mandava o que aparecia, para
 * espalhar a cota de 500 chamadas pelo mês. O preço foi alto e invisível —
 * mandou o mês corrente ainda aberto, e 17 parcelas futuras (out/2026 a
 * jan/2027) que ainda podem ser canceladas. Lançamento que entra lá só sai
 * por exclusão manual.
 *
 * Agora só vai mês com envio autorizado (`monthly_closure.send_authorized_at`,
 * checado dentro de `enviarRazao`). A cota continua cabendo: o fechamento é
 * por empresa, em dias diferentes, e 50 empresas somam ~600 partidas por mês
 * — dois dias de envio, no pior caso em que todas liberem no mesmo dia.
 *
 * O cron segue diário porque o que muda é o gatilho, não o ritmo: o mês
 * liberado hoje sai de madrugada, e o que não coube continua amanhã.
 */

/**
 * Chamadas guardadas para a volta das guias.
 *
 * A volta roda de manhã e o envio de madrugada, mas os dois sacam da MESMA
 * cota de 500. Com 50 empresas, um envio guloso deixaria a volta sem nada — e
 * a volta é a que o cliente sente, porque é dela que vem a guia para pagar.
 *
 * 120 cobre a sondagem de 50 empresas mais a importação completa de algumas
 * dezenas no dia em que as guias saem.
 */
const RESERVA_PARA_A_VOLTA = 120;

/**
 * Teto por execução imposto pelo RELÓGIO, não pela cota.
 *
 * O espaçamento obrigatório de 1,1s entre chamadas (limite de 60/min) faz
 * 272 chamadas ocuparem os 300s de `maxDuration`. Pedir mais que isso não
 * manda mais: manda o mesmo e morre no fim, com o risco de a morte cair entre
 * o OneFlow aceitar um lançamento e nós registrarmos que ele foi.
 *
 * A margem de 40s é para a consulta de implantação, o ensaio de cada mês e a
 * variação de latência da rede.
 */
const MARGEM_DE_SEGURANCA_MS = 40_000;
const TETO_POR_EXECUCAO = 220;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const url = new URL(request.url);
    const pedido = url.searchParams.get('limite');
    const prazo = Date.now() + 300_000 - MARGEM_DE_SEGURANCA_MS;
    const orcamento = Math.min(
      pedido ? Number(pedido) : await cotaRestante(db, RESERVA_PARA_A_VOLTA),
      TETO_POR_EXECUCAO,
    );

    if (orcamento <= 0) {
      return NextResponse.json({
        message: 'Sem cota disponível hoje depois da reserva da volta. Retoma amanhã.',
        orcamento: 0,
      });
    }

    const ligadas = await empresasComAgenteLigado(db, 'envioOneflow');
    const cliente = clienteOneflow(db);
    const relatorio: Record<string, unknown>[] = [];

    let restante = orcamento;
    let interrompido: string | null = null;

    for (const empresa of ligadas) {
      if (restante <= 0) break;

      const [dados] = (await db.execute(sql`
        SELECT cnpj FROM company WHERE id = ${empresa.id}
      `)) as unknown as { cnpj: string }[];
      if (!dados) continue;

      const appHash = await appHashPorCnpj(db, dados.cnpj, empresa.id);
      if (!appHash) continue;

      /**
       * Desde quando o contábil existe lá.
       *
       * Sem isto, o envio tenta meses anteriores à implantação, toma recusa em
       * todos e os marca como ERRO — que depois precisam ser destravados à
       * mão. Aconteceu no primeiro teste: 22 partidas de dezembro/2025 de uma
       * empresa cujo contábil começa em janeiro/2026.
       */
      let inicioContabil: string | null = null;
      try {
        const modulos = await cliente.competenciaInicialDosModulos(empresa.id, appHash);
        inicioContabil = modulos['Contábil'] ?? modulos['Contabil'] ?? null;
      } catch {
        // Sem a data, seguir seria arriscar o lote de erros que ela evita.
        relatorio.push({ empresa: empresa.nome, erro: 'não foi possível ler a implantação do contábil' });
        continue;
      }
      if (!inicioContabil) {
        relatorio.push({ empresa: empresa.nome, erro: 'módulo contábil não implantado no OneFlow' });
        continue;
      }

      /**
       * Meses com partida ainda não enviada, do mais antigo para o mais novo.
       *
       * A ordem importa: a contabilidade de lá recusa lançamento anterior ao
       * início do regime, e enviar fora de ordem deixaria buracos difíceis de
       * localizar depois. Do mais antigo para o mais novo, o que falha falha
       * no começo e fica evidente.
       */
      const meses = (await db.execute(sql`
        SELECT DISTINCT to_char(j.reference_month, 'YYYY-MM-DD') AS mes
          FROM journal_entry j
          -- Só meses com envio autorizado. A mesma trava existe dentro de
          -- enviarRazao; aqui ela evita gastar tempo ensaiando meses que
          -- seriam recusados de qualquer forma.
          JOIN monthly_closure mc
            ON mc.company_id = j.company_id
           AND mc.reference_month = j.reference_month
           AND mc.send_authorized_at IS NOT NULL
         WHERE j.company_id = ${empresa.id}
           AND j.status = 'POSTED'
           AND j.reversed_by IS NULL
           AND j.source <> 'CLOSING'
           AND NOT EXISTS (
             SELECT 1 FROM oneflow_envio e
              WHERE e.journal_entry_id = j.id AND e.status = 'ENVIADO'
           )
         ORDER BY 1
      `)) as unknown as { mes: string }[];

      for (const { mes } of meses) {
        if (restante <= 0) break;
        // Anterior à implantação: o OneFlow recusaria, e a recusa viraria
        // ERRO numa partida que não tem defeito nenhum.
        if (mes.slice(0, 7) < inicioContabil) continue;

        const r = await enviarRazao(
          db, empresa.id, appHash, dados.cnpj, mes, restante, cliente, prazo,
        );
        restante -= r.enviadas;
        if (r.tempoAcabou) { interrompido = `${empresa.nome} (tempo da execução)`; break; }

        if (r.enviadas || r.erros.length || r.bloqueadas) {
          relatorio.push({
            empresa: empresa.nome,
            mes: mes.slice(0, 7),
            enviadas: r.enviadas,
            erros: r.erros.length,
            bloqueadas: r.bloqueadas,
            restantes: r.restantes,
          });
        }
        if (r.erros.length) {
          console.error(`[cron/envio-oneflow] ${empresa.nome} ${mes}:`, r.erros.slice(0, 5));
        }
        if (r.cotaAcabou) { interrompido = empresa.nome; break; }
      }

      // Mês autorizado que não tem mais nada pendente chega a ENVIADO.
      const concluidos = await concluirEnviados(db, empresa.id);
      if (concluidos) relatorio.push({ empresa: empresa.nome, mesesConcluidos: concluidos });

      if (interrompido) break;
    }

    return NextResponse.json({
      message: interrompido
        ? `Interrompido em "${interrompido}": cota diária do OneFlow esgotada.`
        : `Enviadas ${orcamento - restante} partida(s) de ${relatorio.length} mês/empresa.`,
      orcamento,
      gasto: orcamento - restante,
      empresas: relatorio,
    });
  } catch (error) {
    console.error('[cron/envio-oneflow] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
