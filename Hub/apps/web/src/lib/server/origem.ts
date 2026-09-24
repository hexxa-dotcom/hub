import 'server-only';
import { headers } from 'next/headers';

/** O endereço por onde a pessoa está usando a Hexx (https://dominio) — para links públicos. */
export async function origemPublica(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'hexx-hub.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
