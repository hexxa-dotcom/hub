import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { taxGuide, employee, payslip } from '../schema/accounting';
import { financialEntry } from '../schema/finance';
import { escriturarGuia, reescriturarGuia, escriturarLancamento } from './escrituracao';
import { clienteOneflow } from './oneflow-client';

/**
 * A MÃO DE VOLTA: o que o OneFlow sabe e o Hub não.
 *
 * O envio leva o razão para a contabilidade oficial. Esta é a direção
 * contrária, e ela existe porque dois fatos nascem lá, não aqui:
 *
 *   **Guias de imposto** — quem apura é o módulo fiscal do OneFlow, a partir
 *   dos documentos escriturados. O valor do DAS não é uma conta que o Hub
 *   possa refazer por conta própria sem reimplementar a LC 123 inteira e
 *   arriscar divergir do que foi efetivamente declarado.
 *
 *   **Folha** — quem calcula é o módulo de folha, com rubricas, encargos e
 *   eSocial. O Hub tem `payslip` e `employee`, mas hoje são preenchidos à mão.
 *
 * Sem esta volta o cliente vê no Hub um balanço sem imposto e sem pessoal —
 * exatamente as duas maiores linhas de despesa da maioria das empresas.
 *
 * ── O que esta volta NÃO faz ────────────────────────────────────────────
 *
 * Não transmite nada e não decide nada. Ela traz fato apurado e o escritura.
 * Encerrar competência continua sendo `LIBERAR_CONTABIL`, que a régua de
 * autonomia submete à aprovação do contador.
 */

/** Envelope padrão do OneFlow: `{ code, result, _req_uuid }`. */
function conteudo(r: unknown): Record<string, unknown> {
  const o = r as Record<string, unknown> | undefined;
  const res = o?.result;
  return (res && typeof res === 'object' ? res : {}) as Record<string, unknown>;
}

/**
 * O OneFlow devolve coleção vazia como OBJETO vazio, não como lista.
 *
 * `{"recibos":{},"valorTotal":{}}` é a resposta para "não há folha". Tratar
 * isso como um registro, em vez de como zero registros, criaria um
 * contracheque fantasma de valor `NaN` — e ele seria escriturado.
 */
function lista(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  return [];
}

function numero(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** `202601` → `2026-01-01`. */
function primeiroDia(competencia: string): string {
  return `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`;
}

/**
 * Vencimento legal do DAS: dia 20 do mês seguinte à competência.
 *
 * É a única data que a apuração não devolve, e sem ela a guia não pode ser
 * gravada (`due_date` é NOT NULL). A LC 123 art. 21 §1º fixa o dia 20; o
 * deslocamento para o dia útil seguinte quando cai em fim de semana fica com
 * quem paga, porque o Hub não tem calendário de feriados municipais.
 */
function vencimentoPadrao(competencia: string, dia = 20): string {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(4, 6));
  const d = new Date(Date.UTC(ano, mes, dia));
  return d.toISOString().slice(0, 10);
}

/** Nome do tributo no Hub a partir do código de apuração do OneFlow. */
const NOME_DO_IMPOSTO: Record<string, string> = {
  SIMPLES: 'DAS',
  ISS: 'ISS',
  INSS: 'INSS',
  IRRF: 'IRRF',
  PISCOFINS: 'PIS/COFINS',
  IRPJCSLL: 'IRPJ/CSLL',
  ICMS: 'ICMS',
  IPI: 'IPI',
  CPRB: 'CPRB',
  RETENCAO: 'Retenções',
  MEI: 'DAS-MEI',
  FUNRURAL: 'FUNRURAL',
  DIFAL: 'DIFAL',
  ST: 'ICMS-ST',
};

/**
 * Código da obrigação que carrega o ARQUIVO de cada tributo.
 *
 * A apuração dá o valor; o anexo dá o que o cliente usa para pagar. São
 * chamadas diferentes porque são coisas diferentes no OneFlow, e o arquivo
 * costuma ficar pronto depois do valor.
 */
const OBRIGACAO_DO_IMPOSTO: Record<string, string> = {
  SIMPLES: 'GPGDAS',
  MEI: 'GPGDAS',
  IRRF: 'GIRRFRET',
  PISCOFINS: 'GPCC',
  CPRB: 'GCPRB',
  FUNRURAL: 'GFUNRURAL',
  IPI: 'GIPI',
};

/** Tipos de folha que interessam à escrituração mensal. */
const TIPOS_DE_FOLHA: { codigo: number; nome: string }[] = [
  { codigo: 1, nome: 'Folha mensal' },
  { codigo: 2, nome: 'Adiantamento' },
  { codigo: 5, nome: '13º salário' },
  { codigo: 8, nome: 'Férias' },
  { codigo: 10, nome: 'Folha complementar' },
];

export interface RetornoGuia {
  imposto: string;
  taxName: string;
  valor: number;
  acao: 'criada' | 'atualizada' | 'inalterada' | 'zerada' | 'arquivo anexado';
  guiaId: string | null;
  /** Valor que o Hub tinha antes, quando houve divergência. */
  valorAnterior?: number;
}

export interface RetornoFolha {
  tipoFolha: string;
  recibos: number;
  valorTotal: number;
  lancamentoId: string | null;
}

export interface RetornoResult {
  competencia: string;
  guias: RetornoGuia[];
  folha: RetornoFolha[];
  /** Fator R da competência, quando a folha está finalizada lá. */
  fatorR: { valor: number | null; mensagem: string | null } | null;
  /** Partidas gravadas no razão a partir do que voltou. */
  escrituradas: number;
  /** O que impediu parte da volta — nomeado, nunca silencioso. */
  avisos: string[];
}

/**
 * Traz guias e folha de uma competência e escritura o que chegou.
 *
 * Idempotente: rodar duas vezes não duplica nada. A segunda rodada reconhece
 * o que já existe pelo par (empresa, tributo, mês) e só age quando o valor
 * mudou do lado de lá.
 */
export async function importarDoOneflow(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
): Promise<RetornoResult> {
  const of = clienteOneflow(tx);
  const out: RetornoResult = {
    competencia,
    guias: [],
    folha: [],
    fatorR: null,
    escrituradas: 0,
    avisos: [],
  };

  await importarGuias(tx, companyId, appHash, competencia, of, out);
  await importarFolha(tx, companyId, appHash, competencia, of, out);

  // O Fator R só existe com folha mensal finalizada — o próprio OneFlow
  // responde isso quando não há. Perguntar assim mesmo seria queimar uma
  // requisição da cota diária para receber uma frase que já sabemos.
  if (out.folha.length > 0) await lerFatorR(companyId, appHash, competencia, of, out);

  return out;
}

/* ── Guias ──────────────────────────────────────────────────────────────── */

async function importarGuias(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
  of: ReturnType<typeof clienteOneflow>,
  out: RetornoResult,
): Promise<void> {
  let apuracoes: Record<string, unknown>[];
  try {
    apuracoes = lista(conteudo(await of.apuracoesFiscais(companyId, appHash, competencia)).APURACOES);
  } catch (err) {
    out.avisos.push(`Apurações fiscais: ${msg(err)}`);
    return;
  }

  if (apuracoes.length === 0) {
    out.avisos.push('O OneFlow não devolveu apuração fiscal nesta competência.');
    return;
  }

  const referenceMonth = primeiroDia(competencia);

  for (const a of apuracoes) {
    const codigo = String(a.CODIGO ?? '');
    const valor = numero(a.TOTAL_APURADO);
    const taxName = NOME_DO_IMPOSTO[codigo] ?? codigo;

    // Apuração zerada não vira guia. Gravar uma guia de R$ 0,00 encheria a
    // tela do cliente de cobranças que não existem — e o razão de partidas
    // sem valor, que o trigger de equilíbrio recusa de qualquer forma.
    if (valor <= 0) {
      out.guias.push({ imposto: codigo, taxName, valor: 0, acao: 'zerada', guiaId: null });
      continue;
    }

    // A apuração precisa estar FECHADA lá. Valor de apuração aberta ainda
    // muda, e escriturá-lo produziria um estorno a cada rodada do cron.
    if (String(a.STATUS ?? '').toUpperCase() !== 'F') {
      out.avisos.push(`${taxName}: apuração ainda aberta no OneFlow (status ${a.STATUS}). Não escriturada.`);
      continue;
    }

    const [existente] = await tx
      .select()
      .from(taxGuide)
      .where(
        and(
          eq(taxGuide.companyId, companyId),
          eq(taxGuide.taxName, taxName),
          eq(taxGuide.referenceMonth, referenceMonth),
        ),
      );

    /**
     * Guia já completa não custa uma requisição.
     *
     * Buscar o anexo de uma guia que já tem Pix e arquivo gastaria uma das
     * 500 chamadas diárias para reconfirmar o que já está gravado — e essa
     * cota é o recurso mais escasso desta integração.
     */
    const completa = Boolean(existente?.fileUrl && existente?.pixCode);
    const arquivo = completa
      ? { fileUrl: null, pixCode: null }
      : await buscarArquivoDaGuia(of, companyId, appHash, competencia, codigo, out);

    if (!existente) {
      const [nova] = await tx
        .insert(taxGuide)
        .values({
          companyId,
          taxName,
          referenceMonth,
          amount: valor.toFixed(2),
          dueDate: vencimentoPadrao(competencia),
          status: 'OPEN',
          fileUrl: arquivo.fileUrl,
          pixCode: arquivo.pixCode,
        })
        .returning({ id: taxGuide.id });

      const r = await escriturarGuia(tx, companyId, nova!.id);
      out.escrituradas += r.gravadas;
      for (const e of r.erros) out.avisos.push(`${taxName}: ${e.motivo}`);
      out.guias.push({ imposto: codigo, taxName, valor, acao: 'criada', guiaId: nova!.id });
      continue;
    }

    /**
     * O arquivo chega DEPOIS do valor, e é por isso que ele é preenchido aqui
     * mesmo quando o valor não mudou.
     *
     * É a sequência normal: a apuração fecha e a guia é gerada em seguida. Se
     * só preenchêssemos o arquivo na criação, a guia importada na primeira
     * rodada ficaria sem Pix para sempre — o cliente veria o valor e nunca
     * teria como pagar, e nada no sistema acusaria isso.
     *
     * Só preenche o que está VAZIO: um Pix colado à mão pelo contador vale
     * mais que o nosso palpite, e sobrescrevê-lo seria perder trabalho dele.
     */
    const preencher: { fileUrl?: string; pixCode?: string } = {};
    if (!existente.fileUrl && arquivo.fileUrl) preencher.fileUrl = arquivo.fileUrl;
    if (!existente.pixCode && arquivo.pixCode) preencher.pixCode = arquivo.pixCode;
    if (Object.keys(preencher).length) {
      await tx.update(taxGuide).set(preencher).where(eq(taxGuide.id, existente.id));
    }

    const anterior = Number(existente.amount);
    if (Math.abs(anterior - valor) < 0.005) {
      out.guias.push({
        imposto: codigo,
        taxName,
        valor,
        acao: Object.keys(preencher).length ? 'arquivo anexado' : 'inalterada',
        guiaId: existente.id,
      });
      continue;
    }

    // Divergência: a apuração oficial manda. O Hub pode ter a guia de um
    // PGDAS antigo, ou de antes de uma retificação. Corrigir por estorno
    // deixa as duas versões no razão, que é o que permite explicar depois
    // por que o imposto do mês mudou.
    await tx
      .update(taxGuide)
      .set({ amount: valor.toFixed(2) })
      .where(eq(taxGuide.id, existente.id));

    const r = await reescriturarGuia(
      tx,
      companyId,
      existente.id,
      `Apuração do OneFlow para ${competencia}: ${anterior.toFixed(2)} → ${valor.toFixed(2)}`,
    );
    out.escrituradas += r.gravadas;
    for (const e of r.erros) out.avisos.push(`${taxName}: ${e.motivo}`);
    out.guias.push({
      imposto: codigo,
      taxName,
      valor,
      acao: 'atualizada',
      guiaId: existente.id,
      valorAnterior: anterior,
    });
  }
}

/* ── Folha ──────────────────────────────────────────────────────────────── */

/**
 * Traz os totais da folha e os transforma em obrigação a pagar.
 *
 * A folha é escriturada pelo `financial_entry` com `source = 'PAYROLL'`, e
 * não pelo `payslip` — a mesma regra que já vale para a folha lançada à mão.
 * Escriturar os dois lançaria a despesa de pessoal em dobro. O `payslip`
 * continua sendo gravado porque é o documento que o cliente vê; quem vira
 * partida é o lançamento financeiro.
 */
async function importarFolha(
  tx: DbHandle,
  companyId: string,
  appHash: string,
  competencia: string,
  of: ReturnType<typeof clienteOneflow>,
  out: RetornoResult,
): Promise<void> {
  const referenceMonth = primeiroDia(competencia);

  /**
   * UMA chamada decide se vale a pena fazer as outras.
   *
   * O OneFlow tem cota de 500 requisições POR DIA, além das 60 por minuto.
   * Perguntar os cinco tipos de folha a toda empresa em toda competência
   * gastaria a cota do dia inteiro em pouco mais de uma dúzia de empresas —
   * e a esmagadora maioria dessas chamadas volta vazia, porque a empresa não
   * tem 13º em março nem férias todo mês.
   *
   * `statusfolha` responde numa chamada só quais folhas existem. Quando ela
   * não devolve nenhuma, as cinco seguintes são puladas.
   */
  let tiposExistentes: Set<number> | null = null;
  try {
    const st = conteudo(await of.statusDaFolha(companyId, appHash, competencia));
    const linhas = lista((st as Record<string, unknown>).statusDaFolha);
    if (linhas.length > 0) {
      tiposExistentes = new Set(linhas.map((l) => Number(l.tipoFolha ?? l.TIPOFOLHA)).filter(Number.isFinite));
    } else {
      // Objeto vazio = nenhuma folha na competência. Encerra aqui.
      return;
    }
  } catch (err) {
    // Sem o status, o certo é NÃO varrer os cinco tipos às cegas: isso
    // trocaria uma falha por cinco. A competência fica sem folha e o aviso
    // diz por quê, o que é recuperável na próxima rodada.
    out.avisos.push(`Status da folha: ${msg(err)}. Folha não importada nesta competência.`);
    return;
  }

  for (const tipo of TIPOS_DE_FOLHA) {
    if (tiposExistentes && !tiposExistentes.has(tipo.codigo)) continue;

    let res: Record<string, unknown>;
    try {
      res = conteudo(await of.recibosDaFolha(companyId, appHash, competencia, tipo.codigo));
    } catch (err) {
      out.avisos.push(`${tipo.nome}: ${msg(err)}`);
      continue;
    }

    const recibos = lista(res.recibos);
    if (recibos.length === 0) continue; // não há folha desse tipo — normal.

    const valorTotal = recibos.reduce((s, r) => s + numero(r.valorLiquido ?? r.VALOR_LIQUIDO ?? r.valor), 0);
    if (valorTotal <= 0) {
      out.avisos.push(`${tipo.nome}: ${recibos.length} recibo(s) sem valor líquido reconhecível. Não escriturada.`);
      continue;
    }

    for (const r of recibos) await gravarContracheque(tx, companyId, referenceMonth, r);

    const descricao = `${tipo.nome} — ${competencia} (OneFlow)`;
    const externalId = `oneflow:folha:${companyId}:${competencia}:${tipo.codigo}`;

    const [existente] = await tx
      .select({ id: financialEntry.id, amount: financialEntry.amount })
      .from(financialEntry)
      .where(eq(financialEntry.externalId, externalId));

    let lancamentoId: string;
    if (existente) {
      lancamentoId = existente.id;
      if (Math.abs(Number(existente.amount) - valorTotal) >= 0.005) {
        out.avisos.push(
          `${tipo.nome}: valor mudou no OneFlow (${existente.amount} → ${valorTotal.toFixed(2)}). ` +
            'O lançamento NÃO foi alterado — folha já escriturada exige reabertura pelo contador.',
        );
      }
    } else {
      const [novo] = await tx
        .insert(financialEntry)
        .values({
          companyId,
          type: 'PAYABLE',
          status: 'PENDING',
          description: descricao,
          amount: valorTotal.toFixed(2),
          // Salário vence no 5º dia útil; sem calendário de feriados, o dia 5
          // é a aproximação honesta, e o contador ajusta se precisar.
          dueDate: vencimentoPadrao(competencia, 5),
          referenceMonth,
          source: 'PAYROLL',
          externalId,
        })
        .returning({ id: financialEntry.id });
      lancamentoId = novo!.id;

      const r2 = await escriturarLancamento(tx, companyId, lancamentoId);
      out.escrituradas += r2.gravadas;
      for (const e of r2.erros) out.avisos.push(`${tipo.nome}: ${e.motivo}`);
    }

    out.folha.push({
      tipoFolha: tipo.nome,
      recibos: recibos.length,
      valorTotal,
      lancamentoId,
    });
  }
}

/**
 * Grava o contracheque como documento, criando o funcionário se ele ainda não
 * existir no Hub.
 *
 * O funcionário é casado pelo CPF. Sem CPF não dá para casar com segurança, e
 * criar um homônimo novo a cada mês é pior que não criar — então o recibo
 * entra sem contracheque individual e o valor continua na folha total.
 */
async function gravarContracheque(
  tx: DbHandle,
  companyId: string,
  referenceMonth: string,
  recibo: Record<string, unknown>,
): Promise<void> {
  const cpf = String(recibo.cpf ?? recibo.CPF ?? '').replace(/\D/g, '');
  const nome = String(recibo.nome ?? recibo.NOME ?? recibo.trabalhador ?? '').trim();
  const liquido = numero(recibo.valorLiquido ?? recibo.VALOR_LIQUIDO ?? recibo.valor);
  if (!cpf || !nome || liquido <= 0) return;

  const [achado] = await tx
    .select({ id: employee.id })
    .from(employee)
    .where(and(eq(employee.companyId, companyId), sql`regexp_replace(${employee.cpf}, '\\D', '', 'g') = ${cpf}`));

  let employeeId = achado?.id;
  if (!employeeId) {
    const [novo] = await tx
      .insert(employee)
      .values({ companyId, name: nome, cpf, vinculo: 'CLT' })
      .returning({ id: employee.id });
    employeeId = novo!.id;
  }

  const [jaTem] = await tx
    .select({ id: payslip.id })
    .from(payslip)
    .where(and(eq(payslip.employeeId, employeeId), eq(payslip.referenceMonth, referenceMonth)));
  if (jaTem) return;

  await tx.insert(payslip).values({ employeeId, referenceMonth, netAmount: liquido.toFixed(2) });
}

/* ── Fator R ────────────────────────────────────────────────────────────── */

/**
 * Lê o Fator R da competência.
 *
 * É a razão entre folha e receita bruta que decide se a empresa de serviços
 * paga pelo Anexo III ou pelo Anexo V do Simples — a diferença entre 6% e
 * 15,5% de alíquota inicial. O Hub não tem como calculá-lo sem a folha, e é
 * por isso que ele vem junto com ela.
 */
async function lerFatorR(
  companyId: string,
  appHash: string,
  competencia: string,
  of: ReturnType<typeof clienteOneflow>,
  out: RetornoResult,
): Promise<void> {
  try {
    const r = conteudo(await of.fatorR(companyId, appHash, competencia));
    const mensagem = r.msgretorno ? String(r.msgretorno) : null;
    const valor = r.fatorR !== undefined ? numero(r.fatorR) : null;
    out.fatorR = { valor, mensagem };
  } catch (err) {
    out.avisos.push(`Fator R: ${msg(err)}`);
  }
}

/* ── Arquivo da guia ────────────────────────────────────────────────────── */

/**
 * Busca o anexo da obrigação e extrai dele o que serve para PAGAR.
 *
 * ── Por que este parser é defensivo a este ponto ────────────────────────
 *
 * A especificação do OneFlow documenta os parâmetros deste endpoint mas
 * **não documenta o corpo da resposta**, e a única resposta real que
 * observei foi a vazia (`{"obrigacoes":[]}`), porque a HEXX ainda não tem
 * guia gerada lá. Então os nomes de campo abaixo são hipóteses, não fatos.
 *
 * Duas regras decorrem disso, e as duas importam mais que acertar de
 * primeira:
 *
 *   1. Nada é inventado. Se nenhuma hipótese casar, a guia fica sem arquivo
 *      e a tela do cliente diz que ele ainda não saiu — que é a verdade.
 *
 *   2. O formato não reconhecido é RELATADO, com as chaves que vieram. É o
 *      que transforma a primeira guia real num diagnóstico em vez de num
 *      silêncio, sem precisar de nova sondagem manual.
 */
async function buscarArquivoDaGuia(
  of: ReturnType<typeof clienteOneflow>,
  companyId: string,
  appHash: string,
  competencia: string,
  imposto: string,
  out: RetornoResult,
): Promise<{ fileUrl: string | null; pixCode: string | null }> {
  const vazio = { fileUrl: null, pixCode: null };

  const codigo = OBRIGACAO_DO_IMPOSTO[imposto];
  if (!codigo) return vazio;

  let anexos: Record<string, unknown>[];
  try {
    const r = conteudo(await of.anexosDasObrigacoes(companyId, appHash, competencia, codigo));
    anexos = lista(r.obrigacoes);
  } catch (err) {
    out.avisos.push(`Arquivo da guia (${codigo}): ${msg(err)}`);
    return vazio;
  }

  if (anexos.length === 0) return vazio; // ainda não gerada lá — normal.

  const a = anexos[0]!;
  const texto = (...chaves: string[]): string | null => {
    for (const k of chaves) {
      const v = a[k] ?? a[k.toUpperCase()] ?? a[k.toLowerCase()];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  const url = texto('url', 'link', 'urlArquivo', 'urlAnexo', 'caminho', 'download');
  const base64 = texto('arquivo', 'anexo', 'conteudo', 'base64', 'file');
  const pix = texto('pix', 'pixCode', 'copiaECola', 'linhaDigitavel', 'codigoBarras');

  let fileUrl: string | null = url;
  if (!fileUrl && base64 && base64.length > 256) {
    // Base64 vira data: URI — o `href` do botão "Baixar Guia" funciona com
    // ele igual, e o Hub não tem storage externo para arquivo de guia.
    const nome = texto('nomeArquivo', 'nome', 'filename') ?? '';
    const tipo = /\.xml$/i.test(nome) ? 'application/xml' : 'application/pdf';
    fileUrl = `data:${tipo};base64,${base64}`;
  }

  if (!fileUrl && !pix) {
    out.avisos.push(
      `Arquivo da guia (${codigo}): o OneFlow devolveu anexo, mas em formato não reconhecido. ` +
        `Chaves recebidas: ${Object.keys(a).join(', ')}.`,
    );
  }

  return { fileUrl, pixCode: pix };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * A cota diária estourou?
 *
 * Quem roda a volta para várias empresas precisa desta pergunta: seguir para
 * a próxima empresa depois que o dia acabou só produz uma lista de erros
 * idênticos e consome a cota de amanhã. Melhor parar e retomar.
 */
export function cotaDiariaEsgotada(r: RetornoResult): boolean {
  return r.avisos.some((a) => /requisi..es por dia/i.test(a));
}
