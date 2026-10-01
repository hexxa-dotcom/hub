import { getTenantContext } from '@/lib/server/tenant';
import { listarRecibos } from '@/lib/server/recibos';
import RecibosClient from './RecibosClient';

export default async function RecibosPage() {
  const ctx = await getTenantContext();
  const data = await listarRecibos(ctx);
  return <RecibosClient {...data} holding={ctx.companyType === 'HOLDING'} />;
}
