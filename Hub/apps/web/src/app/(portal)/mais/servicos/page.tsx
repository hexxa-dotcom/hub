import {  Stack  } from '@phosphor-icons/react/dist/ssr';
import { HubServicos } from './HubServicos';
import { listSolicitacoesAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const solicitacoes = await listSolicitacoesAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Stack className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Serviços Adicionais</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Solicite serviços extras, alterações, parcelamentos e certidões para sua empresa.
        </p>
      </header>

      <HubServicos initialSolicitacoes={solicitacoes} />
    </div>
  );
}
