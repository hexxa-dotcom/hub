import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { HubPropostas } from './HubPropostas';
import { listPropostasAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const propostas = await listPropostasAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre Propostas & Orçamentos"
            description="Crie, envie e acompanhe propostas comerciais com conversão direta para contratos ou emissão de NFSe."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Propostas &amp; Orçamentos
            </h1>
          </div>
        </div>
      </Card>

      <HubPropostas initialPropostas={propostas} />
    </div>
  );
}

