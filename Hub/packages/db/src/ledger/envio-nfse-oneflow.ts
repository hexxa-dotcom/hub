import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import type { NotaFiscalOneflow } from '@hexxa/integrations';
import { clienteOneflow } from './oneflow-client';

/**
 * ENVIO DAS NOTAS AO MÓDULO FISCAL DO ONEFLOW.
 *
 * A perna que faltava. A Hexx já mandava o razão CONTÁBIL; o módulo FISCAL —
 * que apura o Simples e gera a guia — nunca recebeu nota nenhuma. Por isso a
 * apuração da HEXX voltava zerada em toda competência: não havia receita
 * escriturada lá para apurar.
 *
 * Com isto, o ciclo fecha:
 *
 *   Hub emite nota → ESTE MÓDULO → OneFlow apura → OneFlow gera a guia →
 *   `retorno-oneflow` traz a guia → cliente vê e paga
 *
 * ── Por que só notas realmente emitidas ─────────────────────────────────
 *
 * Só vão notas com `provider_mode = 'gov'` e número de NFS-e. Uma nota
 * 'mock' é de teste, e mandá-la à apuração oficial criaria receita que não
 * existe — e imposto a pagar sobre ela. Um rascunho sem número não é nota.
 *
 * ── O PERIGO PRINCIPAL: a nota entrar duas vezes ────────────────────────
 *
 * O OneFlow pode ser configurado para buscar as notas sozinho no Emissor
 * Nacional, e é assim que a operação funciona hoje. Essa busca é
 * intermitente — alguns meses traz tudo, outros não traz nada —, e é
 * exatamente por isso que este envio existe: para cobrir o que ela não
 * trouxe.
 *
 * Mas a consequência é que **não se pode mandar às cegas**. Quando a busca
 * automática funcionou, a nota já está lá; mandá-la de novo dobraria a
 * receita na apuração, e o cliente pagaria DAS sobre faturamento que não
 * teve. Esse erro é pior que a falta: falta aparece na conferência, receita
 * dobrada aparece no boleto.
 *
 * Por isso o envio SEMPRE pergunta antes o que já está escriturado lá, e
 * manda só o que falta. A comparação é pelo número da NFS-e, que é o único
 * identificador que os dois lados compartilham.
 */

export interface NotaPendente {
  serviceInvoiceId: string;
  nota: NotaFiscalOneflow;
}

export interface EnsaioNfse {
  competencia: string;
  prontas: NotaPendente[];
  /** Notas que não podem ir, com o motivo — nomeado, nunca descartado em silêncio. */
  bloqueadas: { serviceInvoiceId: string; numero: string | null; motivo: string }[];
  jaEnviadas: number;
  /**
   * Notas que o OneFlow já tem, trazidas pela busca automática dele.
   *
   * Separado de `jaEnviadas` de propósito: uma é "nós mandamos antes", a
   * outra é "chegou lá por outro caminho". Confundi-las esconderia o quanto
   * a busca automática está funcionando — que é o que decide se este envio
   * é um remendo eventual ou o mecanismo principal.
   */
  jaNoOneflow: { serviceInvoiceId: string; numero: string }[];
}

/**
 * Números de NFS-e já escriturados no OneFlow na competência.
 *
 * Pagina até o fim: parar na primeira página deixaria passar duplicata em
 * qualquer empresa com mais notas que o tamanho de página, e uma duplicata
 * silenciosa é o pior resultado possível deste módulo.
 */
export async function numerosJaNoOneflow(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
): Promise<Set<string>> {
  const of = clienteOneflow(tx);
  const numeros = new Set<string>();

  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = (await of.documentosFiscais(companyId, appHash, competencia, pagina)) as
      | Record<string, unknown>
      | undefined;
    const res = (r?.result ?? {}) as Record<string, unknown>;
    const docs = Array.isArray(res.documentos)
      ? (res.documentos as Record<string, unknown>[])
      : Array.isArray(res.DOCUMENTOS)
        ? (res.DOCUMENTOS as Record<string, unknown>[])
        : [];

    if (docs.length === 0) break;

    for (const d of docs) {
      const n = d.numeroDocumento ?? d.NUMERO_DOCUMENTO ?? d.numero ?? d.NUMERO;
      if (n !== undefined && n !== null) numeros.add(String(n).trim());
    }
  }

  return numeros;
}

/**
 * Monta as notas de uma competência sem enviar.
 *
 * Existe pelo mesmo motivo do ensaio do razão: descobrir um impedimento por
 * vez, a cada tentativa de envio, é caro — cada rodada gasta requisições da
 * cota diária e deixa metade enviada. O ensaio produz a lista completa de
 * uma vez, e é barato porque não fala com o OneFlow.
 */
export async function ensaiarEnvioNfse(
  tx: DbHandle,
  companyId: string,
  competencia: string,
  /**
   * Números já escriturados no OneFlow, de `numerosJaNoOneflow`.
   *
   * Opcional para que o ensaio possa rodar SEM gastar cota — mas o envio de
   * verdade sempre o passa. Quando vem `undefined`, o ensaio avisa que não
   * conferiu, em vez de deixar quem lê supor que conferiu.
   */
  jaNoOneflow?: Set<string>,
): Promise<EnsaioNfse> {
  const mes = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`;

  const linhas = (await tx.execute(sql`
    SELECT
      si.id::text              AS id,
      si.nfse_number           AS numero,
      si.amount::float         AS valor,
      si.provider_mode         AS modo,
      si.status                AS status,
      to_char(si.created_at, 'YYYY-MM-DD') AS emissao,
      c.name                   AS tomador,
      c.document               AS documento,
      p.item_lista_servico     AS lc116,
      p.aliquota_iss::float    AS aliquota,
      EXISTS (
        SELECT 1 FROM oneflow_nfse o
         WHERE o.service_invoice_id = si.id AND o.status = 'ENVIADA'
      ) AS ja_enviada
    FROM service_invoice si
    LEFT JOIN customer c            ON c.id = si.customer_id
    LEFT JOIN nfse_service_profile p ON p.id = si.nfse_service_profile_id
    WHERE si.company_id = ${companyId}
      AND si.reference_month = ${mes}
    ORDER BY si.created_at
  `)) as unknown as {
    id: string; numero: string | null; valor: number; modo: string | null;
    status: string; emissao: string; tomador: string | null; documento: string | null;
    lc116: string | null; aliquota: number | null; ja_enviada: boolean;
  }[];

  const out: EnsaioNfse = {
    competencia, prontas: [], bloqueadas: [], jaEnviadas: 0, jaNoOneflow: [],
  };

  for (const l of linhas) {
    if (l.ja_enviada) { out.jaEnviadas++; continue; }

    // Já está lá, trazida pela busca automática do OneFlow. Mandar de novo
    // dobraria a receita na apuração.
    if (l.numero && jaNoOneflow?.has(String(l.numero).trim())) {
      out.jaNoOneflow.push({ serviceInvoiceId: l.id, numero: l.numero });
      continue;
    }

    const bloquear = (motivo: string) =>
      out.bloqueadas.push({ serviceInvoiceId: l.id, numero: l.numero, motivo });

    if (l.modo !== 'gov') {
      bloquear(`nota de teste (modo "${l.modo ?? 'não informado'}") — não vai para a apuração oficial.`);
      continue;
    }
    if (!l.numero) { bloquear('sem número de NFS-e — ainda não é nota emitida.'); continue; }
    if (l.status !== 'ISSUED') { bloquear(`status "${l.status}" — só nota emitida é escriturada.`); continue; }
    if (!l.documento) { bloquear('tomador sem CPF/CNPJ — a apuração exige o participante.'); continue; }
    if (!l.tomador) { bloquear('tomador sem nome.'); continue; }
    if (!l.lc116) {
      // A causa mais provável: nota emitida ANTES de o perfil passar a ser
      // guardado. Dizer isso poupa o contador de procurar defeito na nota.
      bloquear(
        'sem código LC 116 — a nota não tem perfil fiscal vinculado. ' +
          'Notas emitidas antes desta versão precisam do perfil informado à mão.',
      );
      continue;
    }
    if (!(l.valor > 0)) { bloquear('valor zero ou inválido.'); continue; }

    out.prontas.push({
      serviceInvoiceId: l.id,
      nota: {
        tipoServico: 'P',
        numeroDocumento: l.numero,
        cpfCnpjParticipante: l.documento.replace(/\D/g, ''),
        razaoSocialParticipante: l.tomador,
        competencia,
        dataEmissao: l.emissao,
        quantidade: 1,
        valorUnitario: l.valor,
        codigoLC116: l.lc116,
        ...(l.aliquota !== null ? { aliquotaISS: l.aliquota } : {}),
        tributacaoServico: '05',
        reterISS: 'N',
      },
    });
  }

  return out;
}

export interface ResultadoEnvioNfse extends EnsaioNfse {
  enviadas: number;
  erros: { serviceInvoiceId: string; motivo: string }[];
}

/**
 * Envia as notas da competência ao módulo fiscal.
 *
 * ── Uma chamada, não N ──────────────────────────────────────────────────
 *
 * O endpoint aceita uma LISTA de notas, e é assim que ele é usado aqui. Com
 * a cota de 500 requisições por dia, mandar uma nota por chamada gastaria a
 * cota de um mês inteiro numa empresa de porte médio. O lote também torna o
 * registro mais simples: ou a remessa entrou, ou não entrou.
 *
 * O preço é grosso: uma nota recusada pode derrubar a remessa. Por isso o
 * ensaio roda antes e retira do lote tudo que já se sabe que não passa.
 */
export async function enviarNfseParaOneflow(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
): Promise<ResultadoEnvioNfse> {
  /**
   * A conferência vem ANTES e não é opcional.
   *
   * Se a consulta falhar, o envio é abortado em vez de seguir às cegas.
   * Mandar sem saber o que já está lá arrisca dobrar a receita apurada, e
   * esse risco não se compensa com a conveniência de "pelo menos tentar":
   * uma competência sem envio se resolve na rodada seguinte, uma competência
   * com receita dobrada vira guia paga a mais.
   */
  let jaLaFora: Set<string>;
  try {
    jaLaFora = await numerosJaNoOneflow(tx, companyId, appHash, competencia);
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    const ens = await ensaiarEnvioNfse(tx, companyId, competencia);
    return {
      ...ens,
      enviadas: 0,
      erros: [{
        serviceInvoiceId: '—',
        motivo:
          `Não foi possível conferir o que já está escriturado no OneFlow (${motivo}). ` +
          'Nada foi enviado: mandar sem conferir arriscaria duplicar a receita da competência.',
      }],
    };
  }

  const ensaio = await ensaiarEnvioNfse(tx, companyId, competencia, jaLaFora);
  const out: ResultadoEnvioNfse = { ...ensaio, enviadas: 0, erros: [] };

  if (ensaio.prontas.length === 0) return out;

  const of = clienteOneflow(tx);

  try {
    await of.enviarNotasFiscais(companyId, appHash, ensaio.prontas.map((p) => p.nota));
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    for (const p of ensaio.prontas) {
      out.erros.push({ serviceInvoiceId: p.serviceInvoiceId, motivo });
      await tx.execute(sql`
        INSERT INTO oneflow_nfse (company_id, service_invoice_id, competencia, status, erro)
        VALUES (${companyId}, ${p.serviceInvoiceId}, ${competencia}, 'ERRO', ${motivo})
      `);
    }
    return out;
  }

  for (const p of ensaio.prontas) {
    await tx.execute(sql`
      INSERT INTO oneflow_nfse (company_id, service_invoice_id, competencia, status)
      VALUES (${companyId}, ${p.serviceInvoiceId}, ${competencia}, 'ENVIADA')
    `);
    out.enviadas++;
  }

  return out;
}
