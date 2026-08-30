export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getDb, eq, withDbTimeout } from '@hexxa/db';
import { ticket } from '@hexxa/db/schema';
import { ContadorShell } from '@/components/contador/ContadorShell';
import { isAdminUser } from '@/lib/server/admin-guard';

/** Área do contador: exige login (Clerk, via proxy) + e-mail na allowlist. */
export default async function ContadorLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) {
    redirect('/cliente?aviso=sem-acesso-contador');
  }

  // Nunca deixar essa contagem travar a área inteira: se o banco não
  // responder rápido, mostra 0 pendências em vez de pendurar a navegação.
  let openTicketsCount = 0;
  try {
    const db = getDb();
    const openTickets = await withDbTimeout(
      db.select({ id: ticket.id }).from(ticket).where(eq(ticket.status, 'OPEN')),
      8000,
    );
    openTicketsCount = openTickets.length;
  } catch (err) {
    console.error('[ContadorLayout] falha ao contar solicitações abertas:', err);
  }

  return <ContadorShell openTicketsCount={openTicketsCount}>{children}</ContadorShell>;
}
