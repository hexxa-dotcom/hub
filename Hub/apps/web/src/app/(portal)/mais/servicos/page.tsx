import { HubServicos } from './HubServicos';
import { listSolicitacoesAction } from './actions';
import { SectionHero } from '@/components/ui/SectionHero';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const solicitacoes = await listSolicitacoesAction();

  return (
    <div className="mx-auto w-full space-y-16 animate-in fade-in">
      <SectionHero
        subtitulo="Peça à contabilidade o que vai além da rotina"
        title="Serviços Adicionais & Alterações"
        infoTitle="Sobre Serviços Adicionais & Alterações"
        infoDescription="Solicite serviços extras, alterações cadastrais, parcelamentos fiscais e certidões negativas com acompanhamento em tempo real."
      />

      <HubServicos initialSolicitacoes={solicitacoes} />
    </div>
  );
}
