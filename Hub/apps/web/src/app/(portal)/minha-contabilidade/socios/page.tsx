import { Users2 } from 'lucide-react';
import { HubSocios } from './HubSocios';

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Users2 className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie o pró-labore e a distribuição de lucros dos sócios da empresa.
        </p>
      </header>

      <HubSocios />
    </div>
  );
}
