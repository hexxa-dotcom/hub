'use server';

import { getDb, withTenant, sql } from '@hexxa/db';
import {
  importarExtrato,
  conciliarExtrato,
  saldoDaTransitoria,
  movimentosNaTransitoria,
  inicioDaJanelaDeExtrato,
  contaDoExtrato,
  criarContaBancaria,
  casarComLancamento,
  escriturarSemPar,
} from '@hexxa/db';
// Nada de constante exportada daqui: um arquivo 'use server' só pode exportar
// funções assíncronas, e o build quebra sem explicar bem o porquê.
import { ExtratoIlegivelError, lerExtrato, textoDoExtrato } from '@hexxa/core';
import { getTenantContext } from '@/lib/server/tenant';
import { identificarMovimentos, responderPergunta } from '@/lib/server/agente-extrato';
import { revalidatePath } from 'next/cache';

/**
 * Upload e processamento do extrato bancário.
 *
 * A ordem das três etapas é a mesma do módulo do razão, e pelo mesmo motivo:
 * importar é só guardar o fato; conciliar é casar com o que já existe;
 * identificar é interpretar o que sobrou. Misturá-las faria um erro de
 * interpretação obrigar a reimportar o arquivo.
 */

export interface EstadoUpload {
  ok: boolean;
  mensagem: string;
  detalhe?: {
    lidas: number;
    novas: number;
    repetidas: number;
    foraDaJanela: number;
    periodo: string | null;
    casadas: number;
    identificadasPorHistorico: number;
    identificadasPorIA: number;
    paraRevisao: number;
    semIdentificacao: number;
    transitoria: number;
  };
}

export async function subirExtratoAction(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  const ctx = await getTenantContext();
  const arquivo = formData.get('arquivo');
  // Vazio = "reconhecer pelo arquivo": o OFX diz de que conta é.
  const escolhida = String(formData.get('bankAccountId') ?? '') || null;

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: 'Escolha um arquivo de extrato.' };
  }
  // 8 MB cobre extrato de ano inteiro em OFX; acima disso é outra coisa.
  if (arquivo.size > 8 * 1024 * 1024) {
    return { ok: false, mensagem: 'Arquivo muito grande (máximo 8 MB).' };
  }

  // `arquivo.text()` presume UTF-8 e estraga os acentos dos bancos que
  // gravam em Windows-1252 — ver `textoDoExtrato`.
  const conteudo = textoDoExtrato(new Uint8Array(await arquivo.arrayBuffer()));
  const db = getDb();

  try {
    const lido = lerExtrato(conteudo);
    const conta = await contaDoExtrato(db, ctx.companyId, escolhida, { banco: lido.banco, conta: lido.conta });
    const imp = await importarExtrato(db, ctx.companyId, conta.id, conteudo);
    const conc = await conciliarExtrato(db, ctx.companyId);

    // A IA só entra depois que o fato e o histórico já fizeram o que podiam.
    const ia = await identificarMovimentos(ctx.companyId);
    const t = await saldoDaTransitoria(db, ctx.companyId, '2999-12-01');

    revalidatePath('/meu-negocio/hub-financeiro');
    revalidatePath('/meu-negocio/hub-financeiro');

    const periodo = imp.de && imp.ate
      ? `${imp.de.split('-').reverse().join('/')} a ${imp.ate.split('-').reverse().join('/')}`
      : null;

    return {
      ok: true,
      mensagem:
        (conta.criada ? `Conta ${conta.nome} reconhecida pelo arquivo e cadastrada. ` : '') +
        (imp.novas === 0
          ? 'Este extrato já tinha sido importado — nada foi duplicado.'
          : `${imp.novas} movimento(s) importado(s) na conta ${conta.nome}.`),
      detalhe: {
        lidas: imp.lidas,
        novas: imp.novas,
        repetidas: imp.repetidas,
        foraDaJanela: imp.foraDaJanela,
        periodo,
        casadas: conc.casadas,
        identificadasPorHistorico: conc.classificadas,
        identificadasPorIA: ia.identificados,
        paraRevisao: ia.paraRevisao + conc.ambiguas,
        semIdentificacao: (await movimentosNaTransitoria(db, ctx.companyId, 500)).length,
        transitoria: t.saldo,
      },
    };
  } catch (err) {
    if (err instanceof ExtratoIlegivelError) {
      return {
        ok: false,
        mensagem:
          `${err.message} Dica: baixe o extrato em OFX no seu banco — é o formato ` +
          'que o sistema lê com exatidão, sem precisar interpretar o desenho da página.',
      };
    }
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

/** Primeiro dia aceito no extrato ('AAAA-MM-DD'), para a tela dizer a data certa. */
export async function janelaDeHistorico(): Promise<string> {
  return inicioDaJanelaDeExtrato();
}

/** Contas bancárias da empresa, para o seletor do upload. */
export async function contasDaEmpresa(): Promise<{ id: string; nome: string }[]> {
  const ctx = await getTenantContext();
  return withTenant(ctx.companyId, async (tx) => {
    const r = await tx.execute(sql`
      SELECT id::text, bank_name, number FROM bank_account
       WHERE company_id = ${ctx.companyId} ORDER BY bank_name
    `);
    return (r as unknown as { id: string; bank_name: string; number: string | null }[]).map((c) => ({
      id: c.id,
      nome: c.number ? `${c.bank_name} · ${c.number}` : c.bank_name,
    }));
  });
}

/** Cadastro manual de conta — para quem só tem extrato em CSV. */
export async function criarContaAction(
  banco: string,
  numero: string,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const ctx = await getTenantContext();
  try {
    const r = await criarContaBancaria(getDb(), ctx.companyId, banco, numero);
    revalidatePath('/meu-negocio/hub-financeiro');
    return { ok: true, id: r.id };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

// ── Perguntas do extrato ─────────────────────────────────────────────────────

/** O empresário responde "o que foi este movimento?". A resposta ensina a base. */
export async function responderPerguntaAction(
  perguntaId: string,
  conta: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getTenantContext();
  const r = await responderPergunta(ctx.companyId, perguntaId, conta, 'EMPRESARIO');
  revalidatePath('/meu-negocio/hub-financeiro');
  if (!r.ok) return { ok: false, mensagem: r.erro ?? 'Não foi possível registrar.' };
  return {
    ok: true,
    mensagem:
      r.resolvidasJuntas > 0
        ? `Aprendido — e ${r.resolvidasJuntas} ${r.resolvidasJuntas === 1 ? 'outro movimento igual foi identificado' : 'outros movimentos iguais foram identificados'} junto.`
        : 'Aprendido. Da próxima vez, este movimento é identificado sozinho.',
  };
}

async function movimento(companyId: string, id: string) {
  const [t] = (await getDb().execute(sql`
    SELECT id::text, to_char(posted_at, 'YYYY-MM-DD') AS data, amount::float AS valor, description AS descricao
      FROM bank_transaction WHERE id = ${id} AND company_id = ${companyId} AND reconciliation_status = 'UNMATCHED'
  `)) as unknown as { id: string; data: string; valor: number; descricao: string }[];
  return t;
}

/** Havia mais de um lançamento possível: o empresário diz qual foi. */
export async function escolherLancamentoAction(bankTransactionId: string, entryId: string): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getTenantContext();
  const t = await movimento(ctx.companyId, bankTransactionId);
  if (!t) return { ok: false, mensagem: 'Movimento não encontrado ou já resolvido.' };
  const [e] = (await getDb().execute(sql`
    SELECT type, amount::float AS valor FROM financial_entry WHERE id = ${entryId} AND company_id = ${ctx.companyId} AND status <> 'PAID'
  `)) as unknown as { type: string; valor: number }[];
  if (!e || e.type !== (t.valor > 0 ? 'RECEIVABLE' : 'PAYABLE') || Math.abs(e.valor - Math.abs(t.valor)) >= 0.01) {
    return { ok: false, mensagem: 'Esse lançamento não bate com o movimento (tipo ou valor).' };
  }
  await casarComLancamento(getDb(), ctx.companyId, t, entryId);
  revalidatePath('/meu-negocio/hub-financeiro');
  return { ok: true, mensagem: 'Conta baixada na data do extrato.' };
}

/** Nenhum dos lançamentos: o movimento segue para a identificação (base, IA verificada ou pergunta). */
export async function naoEhNenhumAction(bankTransactionId: string): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getTenantContext();
  const t = await movimento(ctx.companyId, bankTransactionId);
  if (!t) return { ok: false, mensagem: 'Movimento não encontrado ou já resolvido.' };
  const conta = await escriturarSemPar(getDb(), ctx.companyId, t);
  if (!conta) await identificarMovimentos(ctx.companyId);
  revalidatePath('/meu-negocio/hub-financeiro');
  return { ok: true, mensagem: conta ? 'Identificado pelo que o sistema já sabia.' : 'Certo — ele foi para a identificação.' };
}
