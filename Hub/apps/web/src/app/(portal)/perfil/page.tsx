import { notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/server/tenant';
import { getDb, withTenant, company, appUser, membership, partner, eq, and } from '@hexxa/db';
import { SectionHero } from '@/components/ui/SectionHero';
import { ProfileForm } from './ProfileForm';

export const metadata = {
  title: 'Meu Perfil | Hexx Hub Digital',
  description: 'Gerencie seus dados de acesso, foto de perfil e visualize seus poderes e permissões no Hexx Hub.',
};

export default async function PerfilPage() {
  const ctx = await getTenantContext();
  const db = getDb();

  const isRealUser = /^[0-9a-f-]{36}$/i.test(ctx.userId);
  let resolvedUserId: string | null = isRealUser ? ctx.userId : null;

  // Se estiver em modo bypass/dev, localiza o primeiro usuário da empresa
  if (!resolvedUserId) {
    const [member] = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.companyId, ctx.companyId))
      .limit(1);

    if (member?.userId) {
      resolvedUserId = member.userId;
    }
  }

  if (!resolvedUserId) {
    notFound();
  }

  // Busca dados completos do usuário
  const [userData] = await db
    .select({
      id: appUser.id,
      name: appUser.name,
      email: appUser.email,
      phone: appUser.phone,
      cpf: appUser.cpf,
      avatarUrl: appUser.avatarUrl,
    })
    .from(appUser)
    .where(eq(appUser.id, resolvedUserId));

  if (!userData) {
    notFound();
  }

  // Busca a empresa ativa
  const [dbCompany] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        legalName: company.legalName,
        tradeName: company.tradeName,
      })
      .from(company)
      .where(eq(company.id, ctx.companyId));
  });

  // Busca o papel na empresa atual
  const [memberRole] = await db
    .select({
      role: membership.role,
      authorized: membership.authorized,
    })
    .from(membership)
    .where(and(eq(membership.companyId, ctx.companyId), eq(membership.userId, resolvedUserId)));

  // Verifica se o usuário é sócio no QSA desta empresa
  const [partnerRecord] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        ownershipPct: partner.ownershipPct,
        proLabore: partner.proLabore,
      })
      .from(partner)
      .where(eq(partner.userId, resolvedUserId!))
      .limit(1);
  });

  const profileData = {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    phone: userData.phone,
    cpf: userData.cpf,
    avatarUrl: userData.avatarUrl,
    role: memberRole?.role || 'VIEWER',
    companyName: dbCompany?.tradeName || dbCompany?.legalName || 'Empresa Conectada',
    partnerInfo: partnerRecord
      ? {
          role: 'Sócio-Administrador',
          sharesPercent: Number(partnerRecord.ownershipPct || 0),
          proLaboreMonthly: partnerRecord.proLabore ? Number(partnerRecord.proLabore) : null,
        }
      : null,
  };

  return (
    <div className="space-y-6">
      <SectionHero
        title="Meu Perfil"
        infoDescription="Gerencie seus dados pessoais, foto de identificação e consulte seus poderes e privilégios no Hexx Hub."
        showMonthSelector={false}
      />

      <ProfileForm initialData={profileData} />
    </div>
  );
}
