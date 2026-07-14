import { ClipboardList } from 'lucide-react';
import { HubPropostas } from './HubPropostas';

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Propostas e Orçamentos</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Crie, envie e acompanhe propostas comerciais. Converta aprovadas em nota fiscal com um clique.
        </p>
      </header>

      <HubPropostas />
    </div>
  );
}
