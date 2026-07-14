'use server';

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getDb, company, eq, and } from '@hexxa/db';
import { like } from 'drizzle-orm';
import { getTenantContext } from '@/lib/server/tenant';
import { saveNfseConfig } from '@/lib/server/fiscal';

export type OnboardingState = { ok: boolean; message: string };

const fmtCnpj = (d: string) =>
  d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Consulta o CNPJ (CNPJá com fallback ReceitaWS) e devolve os campos que alimentam o sistema. */
async function lookupCnpj(digits: string) {
  const key = process.env.CNPJA_API_KEY;
  if (key) {
    const res = await fetch(`https://api.cnpja.com/${digits}?simples=true`, {
      headers: { Authorization: key },
      cache: 'no-store',
    });
    if (res.ok) {
      const d = await res.json();
      const addr = d.address ?? {};
      const phone = d.phones?.[0];
      return {
        razaoSocial: (d.company?.name as string) ?? '',
        nomeFantasia: (d.alias as string) ?? null,
        logradouro: (addr.street as string) ?? null,
        numero: (addr.number as string) ?? null,
        complemento: (addr.details as string) ?? null,
        bairro: (addr.district as string) ?? null,
        municipio: (addr.city as string) ?? null,
        codigoMunicipioIbge: addr.municipality ? String(addr.municipality) : null,
        uf: (addr.state as string) ?? null,
        cep: addr.zip ? String(addr.zip).padStart(8, '0') : null,
        telefone: phone ? `${phone.area}${phone.number}`.replace(/\D/g, '') : null,
        email: (d.emails?.[0]?.address as string) ?? null,
        cnae: d.mainActivity?.id ? String(d.mainActivity.id) : null,
        optanteSimples: Boolean(d.company?.simples?.optant),
      };
    }
  }
  const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.status === 'ERROR') return null;
  return {
    razaoSocial: (d.nome as string) ?? '',
    nomeFantasia: (d.fantasia as string) || null,
    logradouro: (d.logradouro as string) ?? null,
    numero: (d.numero as string) ?? null,
    complemento: (d.complemento as string) || null,
    bairro: (d.bairro as string) ?? null,
    municipio: (d.municipio as string) ?? null,
    codigoMunicipioIbge: null, // ReceitaWS não retorna o código IBGE
    uf: (d.uf as string) ?? null,
    cep: d.cep ? String(d.cep).replace(/\D/g, '') : null,
    telefone: d.telefone ? String(d.telefone).replace(/\D/g, '') : null,
    email: (d.email as string) || null,
    cnae: d.atividade_principal?.[0]?.code ? String(d.atividade_principal[0].code).replace(/\D/g, '') : null,
    optanteSimples: false,
  };
}

/**
 * Conclui o onboarding da organização ativa: consulta o CNPJ na Receita e
 * alimenta a empresa (company) + o cadastro fiscal (nfse_config) de uma vez.
 */
export async function completeOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { orgId } = await auth();
  if (!orgId) {
    return { ok: false, message: 'Crie ou selecione uma empresa no seletor do topo antes de continuar.' };
  }

  const digits = String(formData.get('cnpj') ?? '').replace(/\D/g, '');
  if (digits.length !== 14) return { ok: false, message: 'Informe um CNPJ válido (14 dígitos).' };

  let ctx = await getTenantContext();
  const db = getDb();

  // CNPJ já existe no sistema?
  const [dup] = await db
    .select({ id: company.id, clerkOrgId: company.clerkOrgId })
    .from(company)
    .where(eq(company.cnpj, fmtCnpj(digits)));

  if (dup && dup.id !== ctx.companyId) {
    if (!dup.clerkOrgId) {
      // Empresa já cadastrada mas sem organização vinculada → esta organização
      // a assume: descarta a empresa placeholder e vincula a existente.
      await db
        .delete(company)
        .where(and(eq(company.id, ctx.companyId), like(company.cnpj, 'PENDENTE-%')));
      await db.update(company).set({ clerkOrgId: orgId }).where(eq(company.id, dup.id));
      ctx = { ...ctx, companyId: dup.id };
    } else {
      return {
        ok: false,
        message:
          'Este CNPJ já pertence a outra organização. Use o seletor de empresas no topo para trocar para ela — ou peça um convite ao responsável.',
      };
    }
  }

  let data;
  try {
    data = await lookupCnpj(digits);
  } catch {
    data = null;
  }
  if (!data || !data.razaoSocial) {
    return { ok: false, message: 'Não foi possível consultar este CNPJ na Receita. Confira o número e tente novamente.' };
  }

  // 1. Alimenta o cadastro da empresa.
  await db
    .update(company)
    .set({
      legalName: data.razaoSocial,
      tradeName: data.nomeFantasia,
      cnpj: fmtCnpj(digits),
      addressLine1: [data.logradouro, data.complemento].filter(Boolean).join(', ') || null,
      addressNumber: data.numero,
      neighborhood: data.bairro,
      city: data.municipio,
      state: data.uf,
      zipcode: data.cep,
    })
    .where(eq(company.id, ctx.companyId));

  // 2. Semeia o cadastro fiscal (base da emissão de NFS-e).
  await saveNfseConfig(ctx, {
    cnpj: digits,
    razaoSocial: data.razaoSocial,
    nomeFantasia: data.nomeFantasia,
    cep: data.cep,
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    uf: data.uf,
    codigoMunicipio: data.codigoMunicipioIbge,
    telefone: data.telefone,
    emailContato: data.email,
    cnae: data.cnae,
    optanteSimples: data.optanteSimples,
  });

  redirect('/dashboard');
}
