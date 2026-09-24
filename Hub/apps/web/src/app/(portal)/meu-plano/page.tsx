import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, listarFaturasAction } from './actions';
import { SectionHero } from '@/components/ui/SectionHero';
import { dadosDoEscritorio, linkDoWhatsapp } from '@/lib/server/escritorio';

export const metadata = { title: 'Plano | Hexx Digital' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [plano, faturas, escritorio] = await Promise.all([getPlanoAtualAction(), listarFaturasAction(), dadosDoEscritorio()]);

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        subtitulo="O que você contratou da contabilidade e as faturas de honorários"
        title="Plano"
        infoTitle="Sobre o Plano"
        infoDescription="O plano da sua empresa com a contabilidade, o valor combinado e as faturas mensais de honorários, com os adicionais do mês (colaboradores, sócios extras, admissões)."
      />
      <MeuPlanoClient plano={plano} faturas={faturas} whatsappUrl={linkDoWhatsapp(escritorio.whatsapp, 'Olá! Quero falar sobre a fatura de honorários.')} />
    </div>
  );
}
