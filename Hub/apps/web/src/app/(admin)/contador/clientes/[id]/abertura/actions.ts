'use server';

import { getDb, ensaiarAbertura, confirmarAbertura } from '@hexxa/db';
import type { EnsaioAbertura, ResultadoAbertura } from '@hexxa/db';
import { lerBalancete, BalanceteIlegivelError, type LinhaDeBalancete } from '@hexxa/core';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Saldos de abertura — área do contador.
 *
 * ── De quem é este trabalho ─────────────────────────────────────────────
 *
 * Do contador, e a tela vive na área dele por isso. O cliente manda o
 * balancete que o escritório anterior entregou; quem sabe ler "Fornecedores
 * 4.200,00 C" e decidir em que conta do plano isso entra é quem entende de
 * contabilidade. Pedir esse de-para ao cliente seria transferir a parte
 * difícil para quem menos pode fazê-la.
 *
 * ── Três ações, não uma ─────────────────────────────────────────────────
 *
 * Ler, conferir e abrir são separadas porque o erro caro está no meio.
 * Uma abertura errada costuma FECHAR — trocar duas contas de lugar não
 * desequilibra nada — então o balanço não acusa, e ninguém percebe até o
 * primeiro relatório sair torto. A conferência é a única chance de ver.
 */

export interface EstadoLeitura {
  ok: boolean;
  mensagem: string;
  linhas?: LinhaDeBalancete[];
  dataFinal?: string | null;
  origem?: string;
  ladoExplicito?: boolean;
  descartadas?: number;
  ensaio?: EnsaioAbertura;
}

/** Tamanho que cobre um balancete de ano inteiro; acima disso é outra coisa. */
const LIMITE_BYTES = 8 * 1024 * 1024;

export async function lerBalanceteAction(
  _prev: EstadoLeitura,
  formData: FormData,
): Promise<EstadoLeitura> {
  await requireAdmin();

  const companyId = String(formData.get('companyId') ?? '');
  const arquivo = formData.get('arquivo');
  const colado = String(formData.get('colado') ?? '').trim();

  if (!companyId) return { ok: false, mensagem: 'Empresa não identificada.' };

  let conteudo: string;
  let origem: string;

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > LIMITE_BYTES) {
      return { ok: false, mensagem: 'Arquivo muito grande (máximo 8 MB).' };
    }
    origem = arquivo.name;
    try {
      conteudo = /\.pdf$/i.test(arquivo.name)
        ? await textoDoPdf(arquivo)
        : await arquivo.text();
    } catch (err) {
      return {
        ok: false,
        mensagem: `Não consegui ler o arquivo: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else if (colado) {
    conteudo = colado;
    origem = 'colado da planilha';
  } else {
    return { ok: false, mensagem: 'Escolha um arquivo ou cole as linhas do balancete.' };
  }

  try {
    const lido = lerBalancete(conteudo);
    const ensaio = await ensaiarAbertura(getDb(), companyId, lido.linhas);

    return {
      ok: true,
      mensagem: `${lido.linhas.length} conta(s) lida(s) de "${origem}".`,
      linhas: lido.linhas,
      dataFinal: lido.dataFinal,
      origem,
      ladoExplicito: lido.ladoExplicito,
      descartadas: lido.descartadas,
      ensaio,
    };
  } catch (err) {
    if (err instanceof BalanceteIlegivelError) return { ok: false, mensagem: err.message };
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

/** Reconfere depois de o contador mexer no de-para. Não grava nada. */
export async function conferirAction(
  companyId: string,
  linhas: LinhaDeBalancete[],
  dePara: Record<string, string>,
): Promise<{ ok: boolean; ensaio?: EnsaioAbertura; erro?: string }> {
  await requireAdmin();
  try {
    return { ok: true, ensaio: await ensaiarAbertura(getDb(), companyId, linhas, dePara) };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function abrirAction(
  companyId: string,
  data: string,
  linhas: LinhaDeBalancete[],
  dePara: Record<string, string>,
  origem: string,
): Promise<{ ok: boolean; resultado?: ResultadoAbertura; erro?: string }> {
  await requireAdmin();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, erro: 'Informe a data de encerramento do balancete.' };
  }

  try {
    const r = await confirmarAbertura(getDb(), companyId, data, linhas, dePara, origem);
    revalidatePath(`/contador/clientes/${companyId}`);
    revalidatePath(`/contador/clientes/${companyId}/abertura`);
    return { ok: true, resultado: r };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Texto de um PDF.
 *
 * O `require` fica dentro da função de propósito: `pdf-parse` referencia
 * `DOMMatrix`, que é um global de browser, em algum ponto da cadeia de import
 * dele — e o Next avalia o módulo inteiro na hora de coletar os dados da
 * página. Um import de topo derruba o build inteiro. Mesmo motivo do
 * processamento de PGDAS, em `../fiscal/actions.ts`.
 */
async function textoDoPdf(arquivo: File): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const dados = await pdfParse(buffer);
  const texto = String(dados.text ?? '');

  if (texto.replace(/\s/g, '').length < 50) {
    throw new BalanceteIlegivelError(
      'Este PDF não tem texto — provavelmente é uma digitalização (foto ou scan). ' +
        'Peça o balancete em Excel, CSV, ou um PDF gerado pelo sistema contábil.',
    );
  }
  return texto;
}
