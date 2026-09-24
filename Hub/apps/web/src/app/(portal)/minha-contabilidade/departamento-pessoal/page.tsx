import { SectionHero } from '@/components/ui/SectionHero';
import { HubDP } from './HubDP';
import { listEmployeesAction, listVacationPeriodsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [colaboradores, ferias] = await Promise.all([listEmployeesAction(), listVacationPeriodsAction()]);

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        subtitulo="Equipe, férias e quanto cada pessoa custa por mês"
        title="Colaboradores"
        infoTitle="Sobre Colaboradores"
        infoDescription="Cadastro da equipe CLT, estágio e PJ, controle de férias e o custo mensal estimado. O salário líquido entra sozinho no financeiro como previsão; a folha oficial e o holerite vêm da contabilidade."
      />

      <HubDP initialColaboradores={colaboradores} initialFerias={ferias} />
    </div>
  );
}

