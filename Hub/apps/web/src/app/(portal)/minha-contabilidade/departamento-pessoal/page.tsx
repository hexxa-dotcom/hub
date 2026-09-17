import { Card } from '@/components/ui/Card';
import { HubDP } from './HubDP';
import { listEmployeesAction, listVacationPeriodsAction, listPayslipsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [colaboradores, ferias, folhas] = await Promise.all([
    listEmployeesAction(),
    listVacationPeriodsAction(),
    listPayslipsAction(),
  ]);

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
        <h1 className="font-serif font-bold text-display text-ink tracking-tight">
          Gestão de Colaboradores
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Gestão completa de equipe CLT e prestadores PJ, holerites, folha de pagamento e controle de férias.
        </p>
      </Card>

      <HubDP initialColaboradores={colaboradores} initialFerias={ferias} initialFolhas={folhas} />
    </div>
  );
}

