import { HubServicos } from './HubServicos';
import { listSolicitacoesAction } from './actions';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const solicitacoes = await listSolicitacoesAction();

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre Serviços Adicionais & Alterações"
            description="Solicite serviços extras, alterações cadastrais, parcelamentos fiscais e certidões negativas com acompanhamento em tempo real."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Serviços Adicionais &amp; Alterações
            </h1>
          </div>
        </div>
      </Card>

      <HubServicos initialSolicitacoes={solicitacoes} />
    </div>
  );
}
