import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { traduzirConta, contasSemDestino, dataOneflow } from '@hexxa/core';

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
 *    ele zeraria de novo: o lucro sairia dobrado no patrimônio líquido.
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
