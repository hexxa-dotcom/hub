import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
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
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Gestão de Colaboradores
            </h1>
            <SectionInfo
              title="Sobre a Gestão de Colaboradores"
              description="Gestão completa de equipe CLT e prestadores PJ, holerites, folha de pagamento e controle de férias."
            />
          </div>
        </div>
      </Card>

      <HubDP initialColaboradores={colaboradores} initialFerias={ferias} initialFolhas={folhas} />
    </div>
  );
}

