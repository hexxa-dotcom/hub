import { redirect } from 'next/navigation';
import { VerificarForm } from './VerificarForm';
import type { AuthArea } from '../actions';

export const dynamic = 'force-dynamic';

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; area?: string; next?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.email) redirect('/auth/login' as never);

  const area: AuthArea = sp.area === 'contador' ? 'contador' : 'cliente';
  const next = sp.next || (area === 'contador' ? '/contador' : '/cliente');

  return <VerificarForm area={area} email={sp.email} next={next} />;
}
