import { listSupportTicketsAction } from './actions';
import { SuporteClient } from './SuporteClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const tickets = await listSupportTicketsAction();
  return <SuporteClient initialTickets={tickets} />;
}
