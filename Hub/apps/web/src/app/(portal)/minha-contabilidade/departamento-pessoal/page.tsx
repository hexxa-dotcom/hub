import { SectionHero } from '@/components/ui/SectionHero';
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
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        subtitulo="Funcionários, sócios e prestadores da empresa"
        title="Gestão de Colaboradores"
        infoTitle="Sobre a Gestão de Colaboradores"
        infoDescription="Gestão completa de equipe CLT e prestadores PJ, holerites, folha de pagamento e controle de férias."
      />

      <HubDP initialColaboradores={colaboradores} initialFerias={ferias} initialFolhas={folhas} />
    </div>
  );
}

