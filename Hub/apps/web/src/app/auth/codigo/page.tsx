export const dynamic = 'force-dynamic';
import { CodigoForm } from './CodigoForm';
import type { AccessArea } from './actions';

export default async function CodigoPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const area: AccessArea = sp.area === 'contador' ? 'contador' : 'cliente';
  const next = sp.next || (area === 'contador' ? '/contador' : '/cliente');

  return <CodigoForm area={area} next={next} />;
}
