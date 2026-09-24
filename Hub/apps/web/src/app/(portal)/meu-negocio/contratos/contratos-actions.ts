'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { businessContract } from '@hexxa/db/schema';
import { normalizeDocument } from '@hexxa/core/document-br';
import { lookupCnpj } from '@/lib/server/receita';
import {
  criarContrato,
  assinarNoHub,
  reajustarContrato,
  indiceAcumulado12m,
  quemAssina,
  empresaDoHubPeloCnpj,
  type NovoContrato,
  type ResultadoDaCriacao,
} from '@/lib/server/contratos';
import type { IndiceDeReajuste } from './modelos';

/**
 * As ações da tela de Contratos. A empresa vem sempre da sessão — nunca de
 * um argumento — para uma ação não poder agir em nome de outra empresa.
 */

function atualizar() {
  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
}

export async function criarContratoAction(input: NovoContrato): Promise<ResultadoDaCriacao> {
  const ctx = await getTenantContext();
  try {
    const r = await criarContrato(ctx, input);
    if (r.ok) atualizar();
    return r;
  } catch (err) {
    console.error('[contratos] erro ao criar:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Não consegui criar o contrato.' };
  }
}

export async function assinarNoHubAction(contratoId: string, nome: string, cpf: string) {
  const ctx = await getTenantContext();
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  const r = await assinarNoHub(ctx, contratoId, { nome, cpf }, { ip, userAgent: h.get('user-agent') });
  if (r.ok) atualizar();
  return r;
}

/** A empresa terminou de assinar no DocuSeal embutido: some o "Assinar agora". */
export async function marcarQueAssineiAction(contratoId: string) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) =>
    tx
      .update(businessContract)
      .set({ ownSignUrl: null, updatedAt: new Date() })
      .where(and(eq(businessContract.id, contratoId), eq(businessContract.companyId, ctx.companyId))),
  );
  atualizar();
  return { ok: true };
}

export async function reajustarAction(contratoId: string, percentual: number) {
  const ctx = await getTenantContext();
  const r = await reajustarContrato(ctx, contratoId, percentual);
  if (r.ok) {
    atualizar();
    revalidatePath(`/meu-negocio/contratos/${contratoId}`);
  }
  return r;
}

export async function indiceAction(indice: IndiceDeReajuste) {
  return indiceAcumulado12m(indice);
}

/** Quem assina pela empresa — para já vir preenchido. */
export async function signatarioAction() {
  const ctx = await getTenantContext();
  const s = await quemAssina(ctx);
  return s ? { nome: s.nome, cpf: s.cpf ?? '' } : { nome: '', cpf: '' };
}

/**
 * Com quem é o contrato: pelo CNPJ, os dados da Receita e se a empresa já
 * usa o Hub (aí a assinatura e o financeiro dela ficam ligados ao contrato).
 */
export async function consultarParteAction(documento: string): Promise<
  | { ok: false; message: string }
  | { ok: true; nome: string; endereco: string; email: string | null; usaOHub: boolean }
> {
  const ctx = await getTenantContext();
  const digitos = normalizeDocument(documento);
  if (digitos.length !== 14) return { ok: false, message: 'CPF não é consultado: preencha o nome e o endereço.' };
  const [doHub, receita] = await Promise.all([empresaDoHubPeloCnpj(digitos, ctx.companyId), lookupCnpj(digitos).catch(() => null)]);
  if (!receita && !doHub) return { ok: false, message: 'Não achei esse CNPJ na Receita. Confira os números.' };
  const endereco = receita
    ? [
        receita.logradouro ? `${receita.logradouro}, ${receita.numero || 's/n'}` : null,
        receita.bairro,
        receita.municipio && receita.uf ? `${receita.municipio}/${receita.uf}` : receita.municipio,
      ]
        .filter(Boolean)
        .join(' — ')
    : '';
  return {
    ok: true,
    nome: doHub?.legalName ?? receita!.razaoSocial,
    endereco,
    email: doHub?.email ?? receita?.email ?? null,
    usaOHub: Boolean(doHub),
  };
}
