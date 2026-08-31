'use server';

import { redirect } from 'next/navigation';
import { getDb, company, membership, eq, and, withDbTimeout } from '@hexxa/db';
import { ne } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { resolveAppUser } from '@/lib/server/tenant';
import { saveNfseConfig } from '@/lib/server/fiscal';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';

export type OnboardingState = { ok: boolean; message: string };

/** Consulta o CNPJ (CNPJá com fallback ReceitaWS) e devolve os campos que alimentam o sistema. */
async function lookupCnpj(doc: string) {
  const key = process.env.CNPJA_API_KEY;
  if (key) {
    const res = await fetch(`https://api.cnpja.com/${doc}?simples=true`, {
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
  const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${doc}`, {
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
 * Conclui o onboarding: consulta o CNPJ na Receita e cria (ou completa) a
 * empresa + o cadastro fiscal (nfse_config) + a membership OWNER do usuário.
 *
 * `existingCompanyId` só vem preenchido no caso legado: usuário já tinha uma
 * membership pré-Supabase (backfill da migração de auth) apontando pra uma
 * empresa com CNPJ placeholder — aqui só completamos o CNPJ real dela, sem
 * criar uma empresa nova.
 */
export async function completeOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
  }

  // normalizeDocument PRESERVA letras — CNPJ alfanumérico (obrigatório pra
  // novos CNPJs a partir de jul/2026) tem os 12 primeiros caracteres
  // podendo ser letra OU dígito; um replace(/\D/g,'') bloquearia o onboarding
  // de qualquer empresa nova constituída depois disso.
  const doc = normalizeDocument(String(formData.get('cnpj') ?? ''));
  if (doc.length !== 14) return { ok: false, message: 'Informe um CNPJ válido (14 caracteres).' };
  const existingCompanyId = String(formData.get('existingCompanyId') ?? '') || null;

  let data;
  try {
    data = await lookupCnpj(doc);
  } catch {
    data = null;
  }
  if (!data || !data.razaoSocial) {
    return { ok: false, message: 'Não foi possível consultar este CNPJ na Receita. Confira o número e tente novamente.' };
  }

  const db = getDb();
  const appUserRow = await resolveAppUser(user.id, user.email);
  const cnpjFormatado = formatDocument(doc);
  const addressFields = {
    legalName: data.razaoSocial,
    tradeName: data.nomeFantasia,
    cnpj: cnpjFormatado,
    addressLine1: [data.logradouro, data.complemento].filter(Boolean).join(', ') || null,
    addressNumber: data.numero,
    neighborhood: data.bairro,
    city: data.municipio,
    state: data.uf,
    zipcode: data.cep,
  };

  let companyId: string;

  if (existingCompanyId) {
    // Legado: só completa o CNPJ da empresa que a membership já aponta.
    const [dup] = await withDbTimeout(
      db.select({ id: company.id }).from(company).where(and(eq(company.cnpj, cnpjFormatado), ne(company.id, existingCompanyId))),
      8000,
    );
    if (dup) {
      return { ok: false, message: 'Este CNPJ já pertence a outra empresa cadastrada. Peça um convite ao responsável.' };
    }
    await withDbTimeout(db.update(company).set(addressFields).where(eq(company.id, existingCompanyId)), 8000);
    companyId = existingCompanyId;
  } else {
    const [dup] = await withDbTimeout(db.select({ id: company.id }).from(company).where(eq(company.cnpj, cnpjFormatado)), 8000);
    if (dup) {
      const [existingMembership] = await db.select({ id: membership.id }).from(membership).where(eq(membership.companyId, dup.id));
      if (existingMembership) {
        return {
          ok: false,
          message: 'Este CNPJ já pertence a outra empresa cadastrada. Peça um convite ao responsável.',
        };
      }
      // Empresa já existe mas sem ninguém vinculado (ex.: criada por engano antes) — este usuário a adota.
      await withDbTimeout(db.update(company).set(addressFields).where(eq(company.id, dup.id)), 8000);
      companyId = dup.id;
    } else {
      const [created] = await withDbTimeout(
        db.insert(company).values({ ...addressFields, type: 'SERVICE' }).returning({ id: company.id }),
        8000,
      );
      companyId = created!.id;
    }
    await db.insert(membership).values({ companyId, userId: appUserRow.id, role: 'OWNER' });
  }

  // Semeia o cadastro fiscal (base da emissão de NFS-e).
  await saveNfseConfig(
    { companyId, companyType: 'SERVICE', userId: appUserRow.id },
    {
      cnpj: doc,
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
    },
  );

  redirect('/cliente');
}
