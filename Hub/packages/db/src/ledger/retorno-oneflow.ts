import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { taxGuide, employee, payslip } from '../schema/accounting';
import { escriturarGuia, reescriturarGuia } from './escrituracao';
import { postJournal } from './repository';
import { accrueFolha } from '@hexxa/core';
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

/**
 * UUID derivado de uma chave de texto, sempre o mesmo para a mesma chave.
 *
 * A folha do mês não é uma linha de tabela: é o agregado dos recibos de uma
 * competência. Mas `journal_entry.source_id` é UUID, e é ele que forma a
 * chave de idempotência (empresa, origem, documento, fato). Sem um id
 * estável, cada rodada do cron lançaria a mesma folha de novo.
 *
 * Determinístico e não aleatório justamente por isso: reexecutar reconhece o
 * que já existe em vez de duplicar a despesa de pessoal.
 */
function idDeterminista(chave: string): string {
  const h = createHash('sha1').update(chave).digest('hex');
  // Formato UUID, com a versão 5 marcada — é o que a especificação reserva
  // para identificador derivado de nome.
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '5' + h.slice(13, 16),
    ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
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

/** O `tipoFolha` do status vem por NOME; os recibos são pedidos por código. */
const CODIGO_POR_NOME: Record<string, number> = {
  mensal: 1,
  adiantamento: 2,
  férias: 8,
  ferias: 8,
  complementar: 10,
};

/**
 * Quais folhas existem na competência, a partir do `statusfolha`.
 *
 * ── O formato que me enganou ────────────────────────────────────────────
 *
 * `statusDaFolha` é um OBJETO, não uma lista:
 *
 *   { competencia: "202608", status: "Fechada", tipoFolha: "Mensal", … }
 *
 * e quando NÃO há folha, é o mesmo objeto com os valores vazios:
 *
 *   { competencia: {}, status: {}, tipoFolha: {}, … }
 *
 * A primeira versão tratava tudo como lista, recebia zero itens nos dois
 * casos, e concluía "não há folha" — inclusive para empresas que tinham. Duas
 * empresas com pró-labore ficaram sem folha nenhuma importada por causa disso,
 * e sem nem um aviso, porque "não há folha" é resposta legítima.
 *
 * Por isso a decisão agora é pelo CONTEÚDO (`status` ser texto), não pelo
 * formato do envelope.
 */
function tiposComFolha(v: unknown): Set<number> {
  const linhas = Array.isArray(v) ? v : [v];
  const out = new Set<number>();

  for (const l of linhas as Record<string, unknown>[]) {
    if (!l || typeof l !== 'object') continue;
    if (typeof l.status !== 'string' || !l.status.trim()) continue;

    const nome = String(l.tipoFolha ?? '').trim().toLowerCase();
    const codigo = CODIGO_POR_NOME[nome] ?? (/13/.test(nome) ? 5 : null);
    // Sem reconhecer o nome, assume a mensal: perder a folha inteira por um
    // rótulo novo é pior que pedir os recibos do tipo mais comum.
    out.add(codigo ?? 1);
  }
  return out;
}

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
    const arquivo: { fileUrl: string | null; pixCode: string | null; vencimento: string | null } =
      completa
        ? { fileUrl: null, pixCode: null, vencimento: null }
        : await buscarArquivoDaGuia(of, companyId, appHash, competencia, codigo, out);

    if (!existente) {
      const [nova] = await tx
        .insert(taxGuide)
        .values({
          companyId,
          taxName,
          referenceMonth,
          amount: valor.toFixed(2),
          // O vencimento do anexo é o real, já deslocado para dia útil pelo
          // OneFlow. `vencimentoPadrao` só entra quando a guia ainda não foi
          // gerada lá e não há anexo de onde tirá-lo.
          dueDate: arquivo.vencimento ?? vencimentoPadrao(competencia),
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
    const preencher: { fileUrl?: string; pixCode?: string; dueDate?: string } = {};
    if (!existente.fileUrl && arquivo.fileUrl) preencher.fileUrl = arquivo.fileUrl;
    if (!existente.pixCode && arquivo.pixCode) preencher.pixCode = arquivo.pixCode;
    // O vencimento real chega junto com o anexo, depois da guia já existir.
    if (arquivo.vencimento && existente.dueDate !== arquivo.vencimento) {
      preencher.dueDate = arquivo.vencimento;
    }
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
    const tipos = tiposComFolha((st as Record<string, unknown>).statusDaFolha);
    if (tipos.size === 0) return; // não há folha na competência.
    tiposExistentes = tipos;
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

    const som = (c: string) => recibos.reduce((s, r) => s + numero(r[c]), 0);
    const proventos = som('totalProventos');
    const liquido = som('totalLiquido');
    const inss = som('INSSSegurado');
    const irrf = som('valorIRPF');

    if (proventos <= 0 || liquido <= 0) {
      out.avisos.push(
        `${tipo.nome}: ${recibos.length} recibo(s) sem proventos ou líquido reconhecíveis ` +
          `(chaves: ${Object.keys(recibos[0] ?? {}).join(', ')}). Não escriturada.`,
      );
      continue;
    }

    for (const r of recibos) await gravarContracheque(tx, companyId, referenceMonth, r);

    // Pró-labore tem conta própria. O recibo diz qual é em `tipoRecibo`.
    const proLabore = recibos.every((r) => /labor/i.test(String(r.tipoRecibo ?? '')));

    const doc = {
      id: idDeterminista(`folha:${companyId}:${competencia}:${tipo.codigo}`),
      referenceMonth,
      tipoFolha: tipo.nome,
      totalProventos: proventos,
      totalLiquido: liquido,
      inssSegurado: inss,
      irrf,
      proLabore,
    };

    try {
      const r2 = await postJournal(tx, companyId, accrueFolha(doc));
      if (!r2.jaExistia) out.escrituradas += 1;
    } catch (err) {
      out.avisos.push(`${tipo.nome}: ${msg(err)}`);
      continue;
    }

    const residuo = Number((proventos - liquido - inss - irrf).toFixed(2));
    if (residuo > 0) {
      out.avisos.push(
        `${tipo.nome}: ${residuo.toFixed(2)} de desconto que o recibo não discrimina ` +
          '(assistência, sindical, vale) foi para Outras Obrigações a Pagar.',
      );
    }

    out.folha.push({
      tipoFolha: tipo.nome,
      recibos: recibos.length,
      valorTotal: proventos,
      lancamentoId: null,
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
 * Busca o anexo da obrigação e traz o PDF da guia.
 *
 * ── O formato, verificado contra guia real ──────────────────────────────
 *
 * Confirmado em 18/09/2026 com a guia do DAS de 08/2026 da SIMED PREV:
 *
 *   { arquivo: "<base64>", dataGeracao, horaGeracao, dataVencimento, valor }
 *
 * O campo `arquivo` NÃO é o PDF em base64 — é uma **URL em base64**. Decodificada,
 * aponta para o CDN da Omie e devolve `application/pdf` de verdade (159 KB no
 * caso observado).
 *
 * ── E ela expira em 24 horas ────────────────────────────────────────────
 *
 * A URL vem assinada, com `Expires` no próprio endereço. Guardá-la em
 * `file_url` daria ao cliente um botão "Baixar Guia" que funciona hoje e
 * morre amanhã — e ele só descobriria na hora de pagar. Por isso o PDF é
 * BAIXADO e guardado como `data:` URI, do mesmo jeito que o sistema já faz
 * com comprovante anexado.
 */
async function buscarArquivoDaGuia(
  of: ReturnType<typeof clienteOneflow>,
  companyId: string,
  appHash: string,
  competencia: string,
  imposto: string,
  out: RetornoResult,
): Promise<{ fileUrl: string | null; pixCode: string | null; vencimento: string | null }> {
  const vazio = { fileUrl: null, pixCode: null, vencimento: null };

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

  // `dataVencimento` vem no formato DD/MM/AAAA e é o vencimento REAL, já
  // deslocado para dia útil. Vale mais que o dia 20 que calculamos sem
  // calendário de feriados.
  const venc = texto('dataVencimento');
  const vencimento = venc && /^\d{2}\/\d{2}\/\d{4}$/.test(venc)
    ? `${venc.slice(6, 10)}-${venc.slice(3, 5)}-${venc.slice(0, 2)}`
    : null;

  const pix = texto('pix', 'pixCode', 'copiaECola', 'linhaDigitavel', 'codigoBarras');
  const bruto = texto('arquivo', 'anexo', 'conteudo', 'base64', 'file');

  if (!bruto) {
    out.avisos.push(
      `Arquivo da guia (${codigo}): anexo sem campo de arquivo. ` +
        `Chaves recebidas: ${Object.keys(a).join(', ')}.`,
    );
    return { ...vazio, pixCode: pix, vencimento };
  }

  let decodificado: string;
  try {
    decodificado = Buffer.from(bruto, 'base64').toString('utf-8');
  } catch {
    decodificado = '';
  }

  // Caminho conhecido: base64 de uma URL assinada.
  if (/^https?:\/\//.test(decodificado)) {
    try {
      const res = await fetch(decodificado);
      if (!res.ok) throw new Error(`CDN respondeu ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const tipo = res.headers.get('content-type')?.split(';')[0] ?? 'application/pdf';
      return {
        fileUrl: `data:${tipo};base64,${bytes.toString('base64')}`,
        pixCode: pix,
        vencimento,
      };
    } catch (err) {
      out.avisos.push(
        `Arquivo da guia (${codigo}): a URL veio, mas o download falhou (${msg(err)}). ` +
          'A guia fica sem arquivo e a próxima rodada tenta de novo.',
      );
      return { ...vazio, pixCode: pix, vencimento };
    }
  }

  // Caminho alternativo: o próprio PDF em base64. Não observado até aqui,
  // mas barato de aceitar — e melhor que recusar um formato plausível.
  if (bruto.length > 1024) {
    return { fileUrl: `data:application/pdf;base64,${bruto}`, pixCode: pix, vencimento };
  }

  out.avisos.push(
    `Arquivo da guia (${codigo}): conteúdo não reconhecido como URL nem como PDF. ` +
      `Chaves recebidas: ${Object.keys(a).join(', ')}.`,
  );
  return { ...vazio, pixCode: pix, vencimento };
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
