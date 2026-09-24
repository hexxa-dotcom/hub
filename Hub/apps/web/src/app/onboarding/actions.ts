'use server';

import { redirect } from 'next/navigation';
import { getDb, company, membership, appUser, eq, and, withDbTimeout } from '@hexxa/db';
import { ne } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { resolveAppUser, modoSemLogin } from '@/lib/server/tenant';
import { gravarEmpresaSemLogin } from '@/lib/server/company-switch';
import { saveNfseConfig } from '@/lib/server/fiscal';
import { lookupCnpj, camposDaEmpresa, baseFiscal } from '@/lib/server/receita';
import { lerDadosDoECnpj } from '@hexxa/integrations';
import { configurarPelaUltimaNota } from '@/lib/server/perfil-de-servico';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';

export type OnboardingState = { ok: boolean; message: string };

/** Dígitos verificadores do CPF. */
function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/** Consulta o CNPJ (CNPJá com fallback ReceitaWS) e devolve os campos que alimentam o sistema. */
async function responsavelSemLogin(cpf: string, nome: string): Promise<{ id: string }> {
  const db = getDb();
  const authUid = `SEM-LOGIN-${cpf}`;
  const [existente] = await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.authUid, authUid));
  if (existente) return existente;
  const [criado] = await db
    .insert(appUser)
    .values({ authUid, name: nome, email: `${cpf}@sem-login.invalido`, cpf })
    .returning({ id: appUser.id });
  return criado!;
}


/**
 * Cria (ou completa) a empresa a partir do CNPJ: consulta a Receita, grava a
 * empresa, o responsável como dono e o cadastro fiscal. Serve aos dois
 * começos do cadastro — pelo formulário e pelo certificado digital.
 */
async function registrarEmpresa(input: {
  doc: string;
  nome: string;
  cpf: string;
  celular: string;
  existingCompanyId: string | null;
  user: { id: string; email?: string } | null;
  semLogin: boolean;
}): Promise<{ ok: false; message: string } | { ok: true; companyId: string; userId: string }> {
  const { doc, nome, cpf, celular, existingCompanyId, user, semLogin } = input;
  let data;
  try {
    data = await lookupCnpj(doc);
  } catch {
    data = null;
  }
  if (!data || !data.razaoSocial) {
    return { ok: false as const, message: 'Não foi possível consultar este CNPJ na Receita. Confira o número e tente novamente.' };
  }

  const db = getDb();
  // Sem login, o responsável vira um usuário sem conta, identificado pelo CPF.
  // Quando o login voltar, é ele quem a empresa terá como dono — e o e-mail
  // de verdade entra no lugar do provisório no primeiro acesso.
  const appUserRow = user
    ? await resolveAppUser(user.id, user.email)
    : await responsavelSemLogin(cpf, nome);
  await withDbTimeout(
    db.update(appUser).set({ name: nome, cpf, phone: celular }).where(eq(appUser.id, appUserRow.id)),
    8000,
  );
  const cnpjFormatado = formatDocument(doc);
  const addressFields = camposDaEmpresa(data, cnpjFormatado);

  let companyId: string;

  if (existingCompanyId) {
    // Legado: só completa o CNPJ da empresa que a membership já aponta.
    const [dup] = await withDbTimeout(
      db.select({ id: company.id }).from(company).where(and(eq(company.cnpj, cnpjFormatado), ne(company.id, existingCompanyId))),
      8000,
    );
    if (dup) {
      return { ok: false as const, message: 'Este CNPJ já pertence a outra empresa cadastrada. Peça um convite ao responsável.' };
    }
    await withDbTimeout(db.update(company).set(addressFields).where(eq(company.id, existingCompanyId)), 8000);
    companyId = existingCompanyId;
  } else {
    const [dup] = await withDbTimeout(db.select({ id: company.id }).from(company).where(eq(company.cnpj, cnpjFormatado)), 8000);
    if (dup) {
      const [existingMembership] = await db.select({ id: membership.id }).from(membership).where(eq(membership.companyId, dup.id));
      if (existingMembership) {
        return {
          ok: false as const,
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
    baseFiscal(data, doc),
  );

  if (semLogin) await gravarEmpresaSemLogin(companyId);
  return { ok: true as const, companyId, userId: appUserRow.id };
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
  const semLogin = !user && modoSemLogin();
  if (!user && !semLogin) {
    return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
  }

  // normalizeDocument PRESERVA letras — CNPJ alfanumérico (obrigatório pra
  // novos CNPJs a partir de jul/2026) tem os 12 primeiros caracteres
  // podendo ser letra OU dígito; um replace(/\D/g,'') bloquearia o onboarding
  // de qualquer empresa nova constituída depois disso.
  const doc = normalizeDocument(String(formData.get('cnpj') ?? ''));
  if (doc.length !== 14) return { ok: false, message: 'Informe um CNPJ válido (14 caracteres).' };
  const existingCompanyId = String(formData.get('existingCompanyId') ?? '') || null;

  // O responsável: o OneFlow exige CPF e celular para criar a empresa lá na
  // aprovação. Pedir agora evita o contador ter que correr atrás depois.
  const nome = String(formData.get('nome') ?? '').trim();
  const cpf = String(formData.get('cpf') ?? '').replace(/\D/g, '');
  const celular = String(formData.get('celular') ?? '').replace(/\D/g, '');
  if (nome.split(/\s+/).length < 2) return { ok: false, message: 'Informe o nome completo do responsável.' };
  if (!cpfValido(cpf)) return { ok: false, message: 'CPF do responsável inválido.' };
  if (celular.length < 10 || celular.length > 11) {
    return { ok: false, message: 'Informe o celular com DDD.' };
  }

  const r = await registrarEmpresa({ doc, nome, cpf, celular, existingCompanyId, user, semLogin });
  if (!r.ok) return r;

  // O passo 1 entrega no passo 2. Mandar para o painel aqui era o que fazia a
  // pessoa achar que tinha acabado — e ficar com nota fiscal não configurada
  // sem saber disso.
  redirect('/onboarding/fiscal');
}

export type EstadoDoCertificado = {
  ok: boolean;
  message: string;
  /** Preenchido quando a empresa foi criada. */
  empresa?: { razaoSocial: string; responsavel: string };
  /** O perfil de emissão montado a partir da última nota, quando houve nota. */
  perfil?: { nome: string; item: string | null; aliquota: number | null };
};

/**
 * O CADASTRO QUE COMEÇA PELO CERTIFICADO.
 *
 * Um e-CNPJ traz o CNPJ, a razão social, o responsável e o CPF dele — ver
 * `lerDadosDoECnpj`. Com o arquivo e a senha, o passo 1 inteiro se preenche
 * sozinho (só o celular não está no certificado), e o passo 2 também: a Hexx
 * busca no Emissor Nacional a última nota emitida e monta o perfil de
 * emissão. Quem tem o certificado vai direto para o último passo.
 */
export async function cadastrarPeloCertificado(
  _prev: EstadoDoCertificado,
  formData: FormData,
): Promise<EstadoDoCertificado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const semLogin = !user && modoSemLogin();
  if (!user && !semLogin) return { ok: false, message: 'Sessão expirada. Faça login novamente.' };

  const arquivo = formData.get('pfx');
  const senha = String(formData.get('senha') ?? '').trim();
  const celular = String(formData.get('celular') ?? '').replace(/\D/g, '');
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, message: 'Escolha o arquivo do certificado.' };
  if (!/\.(pfx|p12)$/i.test(arquivo.name)) return { ok: false, message: 'O certificado é um arquivo .pfx ou .p12.' };
  if (arquivo.size > 1024 * 1024) return { ok: false, message: 'Arquivo grande demais para um certificado.' };
  if (!senha) return { ok: false, message: 'Informe a senha do certificado.' };
  if (celular.length < 10 || celular.length > 11) return { ok: false, message: 'Informe o celular com DDD.' };

  const b64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
  let dados;
  try {
    dados = lerDadosDoECnpj(b64, senha);
  } catch {
    return { ok: false, message: 'Não consegui abrir o certificado. Confira a senha.' };
  }
  if (dados.vencido) return { ok: false, message: `Este certificado venceu em ${dados.validoAte}. Renove e envie de novo.` };
  if (dados.cnpj.length !== 14) {
    return { ok: false, message: 'Este não é o certificado de uma empresa (e-CNPJ). Use a opção sem certificado.' };
  }
  if (!dados.responsavelCpf || !cpfValido(dados.responsavelCpf) || !dados.responsavelNome) {
    return { ok: false, message: 'O certificado não traz o CPF do responsável. Use a opção sem certificado.' };
  }

  const r = await registrarEmpresa({
    doc: dados.cnpj,
    nome: dados.responsavelNome,
    cpf: dados.responsavelCpf,
    celular,
    existingCompanyId: null,
    user,
    semLogin,
  });
  if (!r.ok) return r;

  const ctx = { companyId: r.companyId, companyType: 'SERVICE' as const, userId: r.userId };
  await saveNfseConfig(ctx, { certPfxB64: b64, certPassword: senha });

  const empresa = { razaoSocial: dados.razaoSocial, responsavel: dados.responsavelNome };
  try {
    const perfil = await configurarPelaUltimaNota(ctx);
    if (perfil.ok && perfil.perfil) {
      return {
        ok: true,
        message: perfil.message,
        empresa,
        perfil: { nome: perfil.perfil.nome, item: perfil.lido?.itemListaServico ?? null, aliquota: perfil.lido?.aliquotaIss ?? null },
      };
    }
    return { ok: true, message: perfil.message, empresa };
  } catch (err) {
    console.error('[onboarding/certificado] busca da última nota falhou:', err);
    return { ok: true, message: 'Não consegui consultar o Emissor Nacional agora.', empresa };
  }
}
