import { and, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { appUser, membership, company } from '../schema/tenancy';

/**
 * CONVITE DO CLIENTE À SUA PRÓPRIA EMPRESA.
 *
 * ── O problema ─────────────────────────────────────────────────────────
 *
 * A empresa que vem do OneFlow nasce completa — razão social, endereço,
 * sócios, plano de contas — e sem ninguém que possa entrar nela. Sete das
 * oito empresas do banco estavam assim: existem, são escrituradas, recebem
 * guias, e o dono não tem como ver nada disso.
 *
 * O fluxo antigo resolvia ao contrário: o cliente se cadastrava sozinho e o
 * contador autorizava depois. Era o mesmo erro que o cadastro por formulário
 * — põe o trabalho em quem menos pode fazê-lo, e põe o contador na espera.
 *
 * ── Por que não há tabela de convite ───────────────────────────────────
 *
 * Porque o mecanismo já existia. `resolveAppUser` sabe reclamar uma linha de
 * `app_user` cujo `auth_uid` é `PENDING-<email>`: no primeiro login com
 * aquele e-mail, ela é religada ao usuário real do Supabase, junto com as
 * memberships que já tinha. Foi feito para a migração do Clerk, e serve
 * exatamente para isto.
 *
 * Então convidar é criar a linha pendente e o vínculo. O acesso passa a
 * existir no instante em que a pessoa se cadastra, sem ninguém aprovar nada
 * depois — que é o ponto.
 *
 * `auth_uid` é NOT NULL e vem do provedor de identidade, o que torna
 * impossível criar o usuário de verdade antes de ele existir lá. O prefixo
 * `PENDING-` é o que ocupa o lugar até então, e é reconhecível: qualquer
 * consulta distingue convidado de usuário ativo sem coluna extra.
 */

export type PapelDeConvite = 'OWNER' | 'ADMIN' | 'FINANCE' | 'STAFF' | 'VIEWER';

export interface Convidado {
  userId: string;
  email: string;
  nome: string;
  papel: string;
  /** Ainda não entrou nenhuma vez. */
  pendente: boolean;
  desde: Date;
}

export interface ResultadoConvite {
  userId: string;
  email: string;
  /** Já existia como usuário ativo e só ganhou o vínculo? */
  jaTinhaConta: boolean;
  /** O vínculo já existia — convite repetido não duplica nem falha. */
  jaEraMembro: boolean;
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class EmailInvalidoError extends Error {
  constructor(email: string) {
    super(`"${email}" não parece um endereço de e-mail.`);
    this.name = 'EmailInvalidoError';
  }
}

/**
 * Convida alguém para uma empresa.
 *
 * Idempotente nos dois sentidos que importam: convidar duas vezes o mesmo
 * e-mail não cria duas linhas, e convidar quem já tem conta apenas acrescenta
 * o vínculo — é assim que um contador ganha acesso a mais uma empresa.
 */
export async function convidarParaEmpresa(
  tx: DbHandle,
  companyId: string,
  emailBruto: string,
  papel: PapelDeConvite,
  nomeSugerido?: string,
): Promise<ResultadoConvite> {
  const email = normalizarEmail(emailBruto);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) throw new EmailInvalidoError(emailBruto);

  const [existente] = await tx
    .select({ id: appUser.id, authUid: appUser.authUid })
    .from(appUser)
    .where(eq(appUser.email, email));

  let userId: string;
  let jaTinhaConta = false;

  if (existente) {
    userId = existente.id;
    jaTinhaConta = !existente.authUid.startsWith('PENDING-');
  } else {
    const [criado] = await tx
      .insert(appUser)
      .values({
        authUid: `PENDING-${email}`,
        name: nomeSugerido?.trim() || email.split('@')[0]!,
        email,
      })
      .returning({ id: appUser.id });
    userId = criado!.id;
  }

  const [vinculo] = await tx
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.companyId, companyId), eq(membership.userId, userId)));

  if (vinculo) {
    // Reconvite não é erro: costuma ser correção de papel, ou alguém
    // conferindo se o convite foi feito. Atualiza o papel e segue.
    await tx.update(membership).set({ role: papel, authorized: true }).where(eq(membership.id, vinculo.id));
    return { userId, email, jaTinhaConta, jaEraMembro: true };
  }

  /**
   * `authorized: true` na criação.
   *
   * O campo existe como trava manual de uma época em que o cliente se
   * cadastrava sozinho e precisava ser liberado. Um convite feito PELO
   * contador já é a liberação — deixá-lo falso obrigaria a um segundo ato
   * que não decide nada, e é o tipo de passo que se esquece de dar.
   */
  await tx.insert(membership).values({ companyId, userId, role: papel, authorized: true });

  return { userId, email, jaTinhaConta, jaEraMembro: false };
}

/** Quem tem acesso a esta empresa, e quem ainda não entrou. */
export async function acessosDaEmpresa(tx: DbHandle, companyId: string): Promise<Convidado[]> {
  const linhas = await tx
    .select({
      userId: appUser.id,
      email: appUser.email,
      nome: appUser.name,
      authUid: appUser.authUid,
      papel: membership.role,
      desde: membership.createdAt,
    })
    .from(membership)
    .innerJoin(appUser, eq(appUser.id, membership.userId))
    .where(eq(membership.companyId, companyId));

  return linhas
    .map((l) => ({
      userId: l.userId,
      email: l.email,
      nome: l.nome,
      papel: String(l.papel),
      pendente: l.authUid.startsWith('PENDING-'),
      desde: l.desde,
    }))
    .sort((a, b) => Number(b.pendente) - Number(a.pendente) || a.email.localeCompare(b.email));
}

/**
 * Remove o acesso de alguém a uma empresa.
 *
 * Tira o vínculo, nunca o usuário: a pessoa pode ter acesso a outras
 * empresas, e `app_user` é referenciado por tudo que ela já fez. Apagá-la
 * levaria junto a autoria de lançamentos e aprovações.
 */
export async function removerAcesso(
  tx: DbHandle,
  companyId: string,
  userId: string,
): Promise<{ removido: boolean; motivo?: string }> {
  const donos = await tx
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.companyId, companyId), eq(membership.role, 'OWNER')));

  // Uma empresa sem dono é uma empresa que ninguém administra. O sistema não
  // tem como devolver esse acesso sozinho depois.
  if (donos.length === 1 && donos[0]!.userId === userId) {
    return {
      removido: false,
      motivo: 'É o único dono desta empresa. Convide outro dono antes de remover este acesso.',
    };
  }

  const r = await tx
    .delete(membership)
    .where(and(eq(membership.companyId, companyId), eq(membership.userId, userId)))
    .returning({ id: membership.id });

  return { removido: r.length > 0 };
}

/** Empresas sem ninguém que possa entrar — a lista que o contador precisa ver. */
export async function empresasSemAcesso(
  tx: DbHandle,
): Promise<{ id: string; legalName: string; cnpj: string }[]> {
  const r = (await tx.execute(sql`
    SELECT c.id::text, c.legal_name, c.cnpj
      FROM ${company} c
     WHERE NOT EXISTS (SELECT 1 FROM ${membership} m WHERE m.company_id = c.id)
     ORDER BY c.legal_name
  `)) as unknown as { id: string; legal_name: string; cnpj: string }[];
  return r.map((c) => ({ id: c.id, legalName: c.legal_name, cnpj: c.cnpj }));
}
