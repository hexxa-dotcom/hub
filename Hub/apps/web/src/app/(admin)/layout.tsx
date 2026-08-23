export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getDb, eq } from '@hexxa/db';
import { ticket } from '@hexxa/db/schema';
import { ContadorShell } from '@/components/contador/ContadorShell';
import { isAdminUser } from '@/lib/server/admin-guard';

/** Área do contador: exige login (Clerk, via proxy) + e-mail na allowlist. */
export default async function ContadorLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) {
    redirect('/cliente?aviso=sem-acesso-contador');
  }

  const db = getDb();
  const openTickets = await db.select({ id: ticket.id }).from(ticket).where(eq(ticket.status, 'OPEN'));

  return <ContadorShell openTicketsCount={openTickets.length}>{children}</ContadorShell>;
}
