import { Card } from '@/components/ui/Card';
import { HubPropostas } from './HubPropostas';
import { listPropostasAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const propostas = await listPropostasAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="card-finish">
        <div>
          <h1 className="text-display font-serif text-ink tracking-tight">
            Propostas &amp; Orçamentos
          </h1>
          <p className="mt-1 text-footnote text-ink-soft">
            Crie, envie e acompanhe propostas comerciais com conversão direta para contratos ou emissão de NFSe.
          </p>
        </div>
      </Card>

      <HubPropostas initialPropostas={propostas} />
    </div>
  );
}

