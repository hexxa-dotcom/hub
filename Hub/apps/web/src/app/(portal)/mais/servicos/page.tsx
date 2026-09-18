import { HubServicos } from './HubServicos';
import { listSolicitacoesAction } from './actions';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const solicitacoes = await listSolicitacoesAction();

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 card-finish p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Serviços Adicionais &amp; Alterações
            </h1>
            <SectionInfo
              title="Sobre Serviços Adicionais & Alterações"
              description="Solicite serviços extras, alterações cadastrais, parcelamentos fiscais e certidões negativas com acompanhamento em tempo real."
            />
          </div>
        </div>
      </Card>

      <HubServicos initialSolicitacoes={solicitacoes} />
    </div>
  );
}
