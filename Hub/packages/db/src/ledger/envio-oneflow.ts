import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { traduzirConta, contasSemDestino, dataOneflow } from '@hexxa/core';
import type { LancamentoOneflow } from '@hexxa/integrations';

/**
 * Partidas que nasceram no OneFlow e por isso não voltam para lá.
 *
 * Fragmento SQL sobre `j` (journal_entry), usado em todo lugar que decide o
 * que falta enviar — o ensaio, o cron e a conclusão do mês. Se um deles
 * divergisse, o mês ficaria esperando para sempre uma partida que o envio
 * nunca manda.
 *
 * É a escolha segura enquanto não se confirma se o OneFlow integra fiscal e
 * folha ao contábil sozinho: uma partida que faltar lá dá para mandar depois;
 * uma duplicada só sai por exclusão manual.
 */
export const ORIGEM_ONEFLOW = sql.raw(
  `(j.event = 'ACCRUAL' AND j.source IN ('TAX_GUIDE', 'PAYSLIP'))`,
);

/**
 * ENSAIO E ENVIO DO RAZÃO AO ONEFLOW.
 *
 * O ensaio (`ensaiarEnvio`) monta os lançamentos e NÃO manda nada. Existe
 * porque descobrir conta faltando uma por vez, a cada tentativa de envio, é
 * caro: cada rodada gasta uma chamada, deixa metade enviada, e o contador
 * precisa voltar à tela do OneFlow para criar mais uma. O ensaio produz a
 * lista completa de uma vez.
 */

export interface PartidaParaEnvio {
  journalEntryId: string;
  data: string;
  valor: number;
  documento: string | null;
  partidas: {
    valor: number;
    d_c: 'D' | 'C';
    historico: string;
    classificacao: string;
    cnpjCli?: string;
    cnpjForn?: string;
    razaoSocial?: string;
  }[];
}

export interface EnsaioResult {
  mes: string;
  /** Partidas prontas para enviar. */
  prontas: PartidaParaEnvio[];
  /** Partidas que não podem ir por falta de de-para. */
  bloqueadas: { journalEntryId: string; memo: string; contasFaltando: string[] }[];
  /** Contas do Hub sem destino, com a orientação do que criar no OneFlow. */
  contasACriar: ReturnType<typeof contasSemDestino>;
  /** Já enviadas antes — não vão de novo. */
  jaEnviadas: number;
}

/**
 * Monta os lançamentos de um mês sem enviar.
 *
 * Três exclusões, e cada uma tem razão própria:
 *
 * 1. **Partida estornada** (`reversed_by` preenchido) — foi anulada aqui, não
 *    deve virar lançamento lá.
 *
 * 2. **Espelho de estorno cuja original nunca foi enviada** — se o erro nasceu
 *    e morreu dentro do Hub, o OneFlow não precisa saber que existiu. Mandar o
 *    contra-lançamento sozinho criaria um saldo negativo do nada; mandar o par
 *    poluiria a contabilidade oficial com um erro que nunca chegou lá. Quando
 *    a original TIVER sido enviada, o espelho vai junto — aí ele é necessário
 *    para cancelar do outro lado.
 *
 * 3. **Apuração do resultado** (`source = 'CLOSING'`) — o OneFlow apura
 *    sozinho a partir dos lançamentos que recebe, e tem endpoint próprio para
 *    encerrar competência. Enviar a nossa zeraria as contas de resultado lá e
 *    ele zeraria de novo: o lucro sairia dobrado no patrimônio líquido. *
 * 4. **O que nasceu no OneFlow** — a apuração do imposto (`TAX_GUIDE`,
 *    reconhecimento) e o cálculo da folha (`PAYSLIP`). A volta os importa
 *    para o Hub mostrar o balanço inteiro, mas eles são do fiscal e da folha
 *    de lá, que alimentam o contábil de lá. Devolvê-los duplicaria imposto e
 *    folha nos livros oficiais — e a provisão do DAS, que é estimativa nossa,
 *    iria junto. O PAGAMENTO da guia continua indo: é fato do banco, visto
 *    aqui. Ver `ORIGEM_ONEFLOW`.
 */
export async function ensaiarEnvio(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  cnpjDaEmpresa: string,
): Promise<EnsaioResult> {
  const linhas = (await tx.execute(sql`
    SELECT
      j.id::text AS journal_id,
      to_char(j.entry_date, 'YYYY-MM-DD') AS entry_date,
      j.memo,
      a.code AS conta,
      l.direction,
      l.amount,
      l.line_memo,
      bp.document AS doc_parceiro,
      bp.name AS nome_parceiro,
      EXISTS (SELECT 1 FROM oneflow_envio e
              WHERE e.journal_entry_id = j.id AND e.status = 'ENVIADO') AS ja_enviada
    FROM ledger_line l
    JOIN journal_entry j ON j.id = l.journal_entry_id
    JOIN chart_of_account a ON a.id = l.account_id
    LEFT JOIN business_partner bp ON bp.id = l.partner_id
    WHERE l.company_id = ${companyId}
      AND j.status = 'POSTED'
      AND j.reversed_by IS NULL
      AND j.reference_month = ${referenceMonth}::date
      -- A apuração é do OneFlow, não nossa.
      AND j.source <> 'CLOSING'
      -- O que nasceu lá não volta para lá. Ver item 4 acima.
      AND NOT ${ORIGEM_ONEFLOW}
      -- Espelho de estorno só vai se a partida que ele anula tiver ido antes.
      AND (
        j.event <> 'REVERSAL'
        OR EXISTS (
          SELECT 1 FROM journal_entry orig
          JOIN oneflow_envio env ON env.journal_entry_id = orig.id AND env.status = 'ENVIADO'
          WHERE orig.reversed_by = j.id
        )
      )
    ORDER BY j.entry_date, j.id, l.sequence
  `)) as unknown as Record<string, unknown>[];

  const porPartida = new Map<string, Record<string, unknown>[]>();
  let jaEnviadas = 0;
  const enviadasVistas = new Set<string>();

  for (const l of linhas) {
    const id = String(l.journal_id);
    if (l.ja_enviada) {
      if (!enviadasVistas.has(id)) { enviadasVistas.add(id); jaEnviadas++; }
      continue;
    }
    const atual = porPartida.get(id) ?? [];
    atual.push(l);
    porPartida.set(id, atual);
  }

  const prontas: PartidaParaEnvio[] = [];
  const bloqueadas: EnsaioResult['bloqueadas'] = [];
  const todasAsContas: string[] = [];

  for (const [id, ls] of porPartida) {
    const faltando: string[] = [];
    const partidas: PartidaParaEnvio['partidas'] = [];

    for (const l of ls) {
      const conta = String(l.conta);
      todasAsContas.push(conta);
      const destino = traduzirConta(conta);
      if (!destino) { faltando.push(conta); continue; }

      const doc = String(l.doc_parceiro ?? '').replace(/\D/g, '');
      const ehDebito = String(l.direction) === 'DEBIT';

      // Conta por participante sem CNPJ do parceiro usa o CNPJ da própria
      // empresa: é o caso do banco, em que o "participante" é a instituição
      // e não há parceiro comercial. Sem algum CNPJ o OneFlow recusa.
      const cnpj = doc || (destino.exigeParticipante ? cnpjDaEmpresa.replace(/\D/g, '') : '');

      partidas.push({
        valor: Number(Number(l.amount).toFixed(2)),
        d_c: ehDebito ? 'D' : 'C',
        historico: String(l.line_memo || l.memo).slice(0, 255),
        classificacao: destino.classificacao,
        ...(cnpj && ehDebito ? { cnpjCli: cnpj } : {}),
        ...(cnpj && !ehDebito ? { cnpjForn: cnpj } : {}),
        ...(l.nome_parceiro ? { razaoSocial: String(l.nome_parceiro).slice(0, 120) } : {}),
      });
    }

    if (faltando.length) {
      bloqueadas.push({
        journalEntryId: id,
        memo: String(ls[0]!.memo),
        contasFaltando: [...new Set(faltando)],
      });
      continue;
    }

    // O `valor` do cabeçalho é o total de UM lado. Somar os dois dobraria o
    // lançamento — e os dois números existem e são iguais, então nada gritaria.
    const total = partidas
      .filter((p) => p.d_c === 'D')
      .reduce((s, p) => s + Math.round(p.valor * 100), 0);

    prontas.push({
      journalEntryId: id,
      data: dataOneflow(String(ls[0]!.entry_date)),
      valor: total / 100,
      documento: `HUB-${id.slice(0, 8)}`,
      partidas,
    });
  }

  return {
    mes: referenceMonth,
    prontas,
    bloqueadas,
    contasACriar: contasSemDestino(todasAsContas),
    jaEnviadas,
  };
}

export interface ResultadoEnvioRazao {
  mes: string;
  enviadas: number;
  erros: { journalEntryId: string; motivo: string }[];
  /** Ainda não enviadas por falta de orçamento nesta execução. */
  restantes: number;
  bloqueadas: number;
  cotaAcabou: boolean;
  /** Parou pelo relógio, não pela cota — o resto vai na próxima execução. */
  tempoAcabou: boolean;
  /** O mês não tem envio autorizado — nada foi mandado, e isso não é erro. */
  naoAutorizado: boolean;
}

/**
 * O mês pode sair para a contabilidade oficial?
 *
 * Só depois de o contador liberá-lo e de o envio ser autorizado — que é o
 * que `monthly_closure.send_authorized_at` registra. Liberar e autorizar
 * podem ser o mesmo clique (`envioAutomaticoAoLiberar`) ou dois.
 *
 * ── Por que a trava mora aqui, e não no cron ──────────────────────────────
 *
 * Esta é a única função que manda lançamento ao OneFlow. Uma trava no cron
 * protege o cron; aqui ela protege qualquer caminho que venha a chamar o
 * envio depois — um botão, uma ferramenta de agente, um script.
 *
 * ── O que motivou ─────────────────────────────────────────────────────────
 *
 * O envio era contínuo: todo dia mandava o que aparecia, sem olhar se o mês
 * estava fechado. Mandou o mês corrente, ainda aberto, e mandou 17 partidas
 * de outubro/2026 a janeiro/2027 — parcelas futuras que ainda podem ser
 * canceladas. Lançamento que entra lá só sai por exclusão manual, e a
 * listagem do razão deles não devolve ids. O que chega aos livros oficiais
 * precisa ter passado pelo contador antes.
 */
export async function envioAutorizado(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
): Promise<boolean> {
  const [r] = (await tx.execute(sql`
    SELECT 1 AS ok FROM monthly_closure
     WHERE company_id = ${companyId}
       AND reference_month = ${referenceMonth}::date
       AND send_authorized_at IS NOT NULL
       AND stage IN ('CONFERIDO', 'ENVIADO')
  `)) as unknown as { ok: number }[];
  return Boolean(r);
}

/**
 * Envia o razão de um mês ao OneFlow, até o limite de chamadas concedido.
 *
 * ── Por que há orçamento ────────────────────────────────────────────────
 *
 * O OneFlow aceita UMA partida por chamada, e a cota é de 500 por dia para o
 * escritório inteiro. Setembro teve 519 partidas em cinco empresas — ou seja,
 * um único mês de uma carteira pequena já não cabe num dia.
 *
 * Por isso o envio é contínuo e fatiado, não um empurrão no fechamento: cada
 * execução gasta o que lhe foi concedido, registra o que enviou, e a próxima
 * continua de onde parou. A idempotência de `oneflow_envio` é o que torna
 * isso seguro.
 */
export async function enviarRazao(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  cnpjDaEmpresa: string,
  referenceMonth: string,
  limite: number,
  cliente: {
    enviarLancamento: (c: string, a: string, l: LancamentoOneflow) => Promise<{ id: string | null }>;
  },
  /** Instante (epoch ms) em que esta execução precisa ter terminado. */
  prazo?: number,
): Promise<ResultadoEnvioRazao> {
  if (!(await envioAutorizado(tx, companyId, referenceMonth))) {
    return {
      mes: referenceMonth, enviadas: 0, erros: [], restantes: 0, bloqueadas: 0,
      cotaAcabou: false, tempoAcabou: false, naoAutorizado: true,
    };
  }

  const ensaio = await ensaiarEnvio(tx, companyId, referenceMonth, cnpjDaEmpresa);
  const out: ResultadoEnvioRazao = {
    mes: referenceMonth,
    enviadas: 0,
    erros: [],
    restantes: 0,
    bloqueadas: ensaio.bloqueadas.length,
    cotaAcabou: false,
    tempoAcabou: false,
    naoAutorizado: false,
  };

  for (const [i, p] of ensaio.prontas.entries()) {
    if (out.enviadas >= limite) {
      out.restantes = ensaio.prontas.length - i;
      break;
    }

    /**
     * Para ANTES do prazo, não quando ele chega.
     *
     * O espaçamento obrigatório de 1,1s entre chamadas impõe um teto de ~272
     * chamadas numa função de 300s. Ser morto no meio não seria só perder o
     * resto do lote: se a execução terminar ENTRE o OneFlow aceitar o
     * lançamento e nós registrarmos o envio, a partida existe lá e não consta
     * aqui — e amanhã ela vai de novo, duplicada na contabilidade oficial.
     *
     * Duplicata lá não tem desfazer automático: some só por exclusão manual,
     * e a listagem do razão deles não devolve ids. Por isso a margem é
     * generosa: parar cedo custa um dia; parar tarde custa uma correção à mão.
     */
    if (prazo && Date.now() > prazo) {
      out.restantes = ensaio.prontas.length - i;
      out.tempoAcabou = true;
      break;
    }
    try {
      const r = await cliente.enviarLancamento(companyId, appHash, {
        data: p.data,
        valor: p.valor,
        ...(p.documento ? { documento: p.documento } : {}),
        partidas: p.partidas,
      });
      await registrarEnvio(tx, companyId, p.journalEntryId, r.id);
      out.enviadas++;
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      // Cota diária: parar o lote INTEIRO. Continuar só geraria uma lista de
      // erros idênticos e marcaria como ERRO partidas que não têm defeito
      // nenhum — e elas precisariam ser destravadas à mão depois.
      if (/requisi..es por dia/i.test(motivo)) {
        out.cotaAcabou = true;
        out.restantes = ensaio.prontas.length - i;
        break;
      }
      await registrarEnvio(tx, companyId, p.journalEntryId, null, motivo);
      out.erros.push({ journalEntryId: p.journalEntryId, motivo });
    }
  }

  /**
   * Mês já ENVIADO que recebeu correção agora mudou lá.
   *
   * O espelho do resultado oficial relê o balancete só quando `sent_at`
   * avança. Uma reclassificação ou um estorno enviados depois do mês estar
   * ENVIADO não passavam por `concluirEnviados` — o mês já estava no último
   * estágio —, e o lucro oficial ficava com o número de antes da correção.
   */
  if (out.enviadas > 0) {
    await tx.execute(sql`
      UPDATE monthly_closure SET sent_at = NOW()
       WHERE company_id = ${companyId}
         AND reference_month = ${referenceMonth}::date
         AND stage = 'ENVIADO'
    `);
  }

  return out;
}

/** Registra que uma partida foi enviada, para não mandar de novo. */
export async function registrarEnvio(
  tx: DbHandle,
  companyId: string,
  journalEntryId: string,
  oneflowId: string | null,
  erro?: string,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO oneflow_envio (company_id, journal_entry_id, oneflow_id, status, erro)
    VALUES (${companyId}, ${journalEntryId}, ${oneflowId}, ${erro ? 'ERRO' : 'ENVIADO'}, ${erro ?? null})
    ON CONFLICT DO NOTHING
  `);
}
