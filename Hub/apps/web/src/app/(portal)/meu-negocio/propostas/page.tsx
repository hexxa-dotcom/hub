import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { HubPropostas } from './HubPropostas';
import { listPropostasAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const propostas = await listPropostasAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Propostas &amp; Orçamentos
            </h1>
            <SectionInfo
              title="Sobre Propostas & Orçamentos"
              description="Crie, envie e acompanhe propostas comerciais com conversão direta para contratos ou emissão de NFSe."
            />
          </div>
        </div>
      </Card>

      <HubPropostas initialPropostas={propostas} />
    </div>
  );
}

