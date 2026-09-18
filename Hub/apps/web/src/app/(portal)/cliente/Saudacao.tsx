import { getTenantContext } from '@/lib/server/tenant';
import { appUser, getDb, eq } from '@hexxa/db';

/**
 * Saudação por horário + primeiro nome de quem está acessando.
 *
 * Usa o fuso de São Paulo em vez da hora do servidor: em produção o servidor
 * roda em UTC, então "boa noite" apareceria no meio da tarde de quem está no
 * Brasil.
 */
function periodoDoDia() {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  );

  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export async function Saudacao() {
  let primeiroNome: string | null = null;

  try {
    const ctx = await getTenantContext();
    const [row] = await getDb()
      .select({ name: appUser.name })
      .from(appUser)
      .where(eq(appUser.id, ctx.userId));
    primeiroNome = row?.name?.trim().split(/\s+/)[0] ?? null;
  } catch (err) {
    console.error('[cliente/Saudacao] falha ao carregar o nome do usuário:', err);
  }

  return (
    <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
      {periodoDoDia()}
      {primeiroNome ? `, ${primeiroNome}` : ''}
    </h1>
  );
}
