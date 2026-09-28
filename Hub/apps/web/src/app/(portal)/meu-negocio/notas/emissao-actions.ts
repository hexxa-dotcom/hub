'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { emitirNota, type ResultadoDaEmissao } from '@/lib/server/emissao';
import { agendar, alterarAgendada } from '@/lib/server/emissao-agendada';
import { consultarCnpj, documentoValido, enderecoEmTexto } from '@/lib/server/cnpj';

/**
 * As ações da emissão fácil: um clique a partir da última nota, agendar e
 * cuidar do que está agendado. A emissão em si é sempre `emitirNota`.
 */

/** A última nota do cliente — o que o "um clique" repete. */
export async function ultimaNotaAction(customerId: string): Promise<{ descricao: string; valor: number; perfilId: string | null } | null> {
  const ctx = await getTenantContext();
  const [r] = (await getDb().execute(sql`
    SELECT service_description AS descricao, amount::float AS valor, nfse_service_profile_id::text AS "perfilId"
      FROM service_invoice
     WHERE company_id = ${ctx.companyId} AND customer_id = ${customerId} AND status = 'ISSUED'
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { descricao: string; valor: number; perfilId: string | null }[];
  return r ?? null;
}

/** Emite de novo para o cliente, com a descrição e o perfil da última nota (o valor pode mudar). */
export async function emitirUmCliqueAction(customerId: string, valor: number, descricao: string, confirmarDuplicada = false): Promise<ResultadoDaEmissao> {
  const ctx = await getTenantContext();
  const ultima = await ultimaNotaAction(customerId);
  return emitirNota(ctx, {
    customerId,
    valor,
    descricao,
    perfilId: ultima?.perfilId ?? undefined,
    confirmarDuplicada,
    origem: 'UM_CLIQUE',
  });
}

/** Cliente pelo documento: o existente ou um novo (com o endereço da consulta pública). */
async function clientePeloDocumento(companyId: string, nome: string, documento: string, email?: string): Promise<string | null> {
  const doc = documento.replace(/\D/g, '');
  if (!documentoValido(doc)) return null;
  const db = getDb();
  const [existente] = (await db.execute(sql`
    SELECT id::text FROM customer WHERE company_id = ${companyId} AND regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ${doc} LIMIT 1
  `)) as unknown as { id: string }[];
  if (existente) return existente.id;
  const dados = doc.length === 14 ? await consultarCnpj(doc) : null;
  const [novo] = (await db.execute(sql`
    INSERT INTO customer (company_id, name, document, email, type, endereco, address)
    VALUES (${companyId}, ${nome || dados?.razaoSocial || doc}, ${doc}, ${email || dados?.email || null}, ${doc.length === 14 ? 'PJ' : 'PF'},
            ${dados?.endereco ? JSON.stringify(dados.endereco) : null}::jsonb, ${dados?.endereco ? enderecoEmTexto(dados.endereco) : null})
    RETURNING id::text
  `)) as unknown as { id: string }[];
  return novo?.id ?? null;
}

export async function agendarEmissaoAction(p: {
  customerId?: string;
  nome?: string;
  documento?: string;
  email?: string;
  perfilId?: string;
  descricao: string;
  valor: number;
  data: string;
  repetir: boolean;
  ate?: string;
}): Promise<{ ok: boolean; mensagem: string }> {
  const ctx = await getTenantContext();
  const customerId = p.customerId || (p.documento ? await clientePeloDocumento(ctx.companyId, p.nome ?? '', p.documento, p.email) : null);
  if (!customerId) return { ok: false, mensagem: 'Escolha o cliente ou informe um CPF/CNPJ válido.' };
  const r = await agendar(ctx.companyId, {
    customerId,
    perfilId: p.perfilId,
    descricao: p.descricao,
    valor: p.valor,
    data: p.data,
    repetir: p.repetir,
    ate: p.ate,
  });
  revalidatePath('/meu-negocio/notas');
  return r;
}

export async function alterarAgendadaAction(id: string, acao: 'pausar' | 'retomar' | 'pular' | 'excluir'): Promise<void> {
  const ctx = await getTenantContext();
  await alterarAgendada(ctx.companyId, id, acao);
  revalidatePath('/meu-negocio/notas');
}

/** Marca o serviço (perfil fiscal) que já vem escolhido nas próximas emissões. */
export async function definirPerfilPadraoAction(perfilId: string): Promise<void> {
  const ctx = await getTenantContext();
  const db = getDb();
  await db.execute(sql`UPDATE nfse_service_profile SET padrao = false WHERE company_id = ${ctx.companyId} AND padrao AND id <> ${perfilId}::uuid`);
  await db.execute(sql`UPDATE nfse_service_profile SET padrao = true WHERE company_id = ${ctx.companyId} AND id = ${perfilId}::uuid`);
  revalidatePath('/meu-negocio/notas');
}

export interface ContratoDoCliente {
  codigo: string | null;
  titulo: string;
  descricao: string;
  valor: number;
  inicio: string; // AAAA-MM-DD
}

/**
 * O contrato ATIVO de venda com este CPF/CNPJ — a nota dele já sai com o
 * serviço, o valor e a referência ao contrato nas informações adicionais.
 */
export async function contratoAtivoAction(documento: string): Promise<ContratoDoCliente | null> {
  const doc = documento.replace(/\D/g, '');
  if (doc.length !== 11 && doc.length !== 14) return null;
  const ctx = await getTenantContext();
  const [c] = (await getDb().execute(sql`
    SELECT verification_code AS codigo, title AS titulo, coalesce(nullif(description, ''), title) AS descricao,
           value::float AS valor, to_char(coalesce(signing_date, start_date), 'YYYY-MM-DD') AS inicio
      FROM business_contract
     WHERE company_id = ${ctx.companyId} AND type = 'ENTRADA' AND status = 'ATIVO'
       AND regexp_replace(coalesce(party_cnpj, ''), '[^0-9]', '', 'g') = ${doc}
       AND end_date >= current_date
     ORDER BY start_date DESC LIMIT 1
  `)) as unknown as ContratoDoCliente[];
  return c ?? null;
}

/** A descrição do serviço bate com o CNAE da empresa? — ver `conferencia-servico.ts`. */
export async function conferirServicoAction(descricao: string, perfilId?: string) {
  const ctx = await getTenantContext();
  const { conferirServico } = await import('@/lib/server/conferencia-servico');
  return conferirServico(ctx.companyId, { descricao, perfilId });
}
