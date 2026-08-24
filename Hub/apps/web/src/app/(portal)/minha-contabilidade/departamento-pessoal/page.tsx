import { Users, Sparkles } from 'lucide-react';
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-3.5 w-3.5" />
              Gestão de Pessoas
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Gestão de Colaboradores
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gestão completa de equipe CLT e prestadores PJ, holerites, folha de pagamento e controle de férias.
          </p>
        </div>
      </header>

      <HubDP initialColaboradores={colaboradores} initialFerias={ferias} initialFolhas={folhas} />
    </div>
  );
}

