import { listSupportTicketsAction } from './actions';
import { SuporteClient } from './SuporteClient';
import { dadosDoEscritorio, linkDoWhatsapp } from '@/lib/server/escritorio';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [tickets, escritorio] = await Promise.all([listSupportTicketsAction(), dadosDoEscritorio()]);
  return (
    <SuporteClient
      initialTickets={tickets}
      escritorio={{ nome: escritorio.nome, email: escritorio.email, horario: escritorio.horario, whatsappUrl: linkDoWhatsapp(escritorio.whatsapp) }}
    />
  );
}
