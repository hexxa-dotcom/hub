import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { getDb, eq } from '@hexxa/db';
import { ticket } from '@hexxa/db/schema';
import { ContadorShell } from '@/components/contador/ContadorShell';

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';

function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Área do contador: exige login (Clerk, via proxy) + e-mail na allowlist. */
export default async function ContadorLayout({ children }: { children: React.ReactNode }) {
  if (!DEV_SKIP_AUTH) {
    const user = await currentUser();
    const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
    const isAdmin = emails.some((e) => allowedEmails().includes(e));
    if (!isAdmin) {
      redirect('/dashboard?aviso=sem-acesso-contador');
    }
  }

  const db = getDb();
  const openTickets = await db.select({ id: ticket.id }).from(ticket).where(eq(ticket.status, 'OPEN'));

  return <ContadorShell openTicketsCount={openTickets.length}>{children}</ContadorShell>;
}
