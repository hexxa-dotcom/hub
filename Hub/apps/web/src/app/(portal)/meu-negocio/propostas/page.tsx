import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { HubPropostas } from './HubPropostas';
import { listPropostasAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const propostas = await listPropostasAction();

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        title="Propostas & Orçamentos"
        infoTitle="Sobre Propostas & Orçamentos"
        infoDescription="Crie, envie e acompanhe propostas comerciais com conversão direta para contratos ou emissão de NFSe."
      />

      <HubPropostas initialPropostas={propostas} />
    </div>
  );
}

