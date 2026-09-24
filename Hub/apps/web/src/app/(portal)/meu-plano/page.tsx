import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, getHistoricoCobrancasAction } from './actions';

import { SectionHero } from '@/components/ui/SectionHero';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexx Digital',
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plano = await getPlanoAtualAction();
  const cobrancas = await getHistoricoCobrancasAction(plano?.asaasSubscriptionId ?? null);

  return (
    <div className="mx-auto w-full space-y-16 animate-fade-up">
      <SectionHero
        subtitulo="Seu plano e o histórico de pagamentos"
        title="Meu Plano & Pagamentos"
        infoTitle="Sobre Meu Plano & Pagamentos"
        infoDescription="Seu contrato contábil ativo e o histórico consolidado de faturas do Asaas."
      />

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}

