import {  ClipboardText  } from '@phosphor-icons/react/dist/ssr';
import { HubPropostas } from './HubPropostas';
import { listPropostasAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const propostas = await listPropostasAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <ClipboardText className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Propostas e Orçamentos</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Crie, envie e acompanhe propostas comerciais. Aprovadas viram ponto de partida pra emitir nota fiscal.
        </p>
      </header>

      <HubPropostas initialPropostas={propostas} />
    </div>
  );
}
