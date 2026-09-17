import { HubServicos } from './HubServicos';
import { listSolicitacoesAction } from './actions';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const solicitacoes = await listSolicitacoesAction();

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="card-finish p-6 sm:p-8">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Serviços Adicionais & Alterações
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Solicite serviços extras, alterações cadastrais, parcelamentos fiscais e certidões negativas com acompanhamento em tempo real.
          </p>
        </div>
      </Card>

      <HubServicos initialSolicitacoes={solicitacoes} />
    </div>
  );
}
