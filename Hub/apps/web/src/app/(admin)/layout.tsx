import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { AdminShell } from '@/components/admin/AdminShell';

function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Área administrativa: exige login (Clerk, via proxy) + e-mail na allowlist. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  const isAdmin = emails.some((e) => allowedEmails().includes(e));
  if (!isAdmin) {
    redirect('/dashboard?aviso=sem-acesso-admin');
  }
  return <AdminShell>{children}</AdminShell>;
}
