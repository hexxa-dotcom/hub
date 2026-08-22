import { Users } from '@phosphor-icons/react/dist/ssr';
import { HubDP } from './HubDP';
import { listEmployeesAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const colaboradores = await listEmployeesAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Departamento Pessoal</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gestão de colaboradores, folha de pagamento e controle de férias.
        </p>
      </header>

      <HubDP initialColaboradores={colaboradores} />
    </div>
  );
}
