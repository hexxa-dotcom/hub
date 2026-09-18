import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, getHistoricoCobrancasAction } from './actions';

import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexxa',
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plano = await getPlanoAtualAction();
  const cobrancas = await getHistoricoCobrancasAction(plano?.asaasSubscriptionId ?? null);

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre Meu Plano & Pagamentos"
            description="Seu contrato contábil ativo e o histórico consolidado de faturas do Asaas."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Meu Plano &amp; Pagamentos
            </h1>
          </div>
        </div>
      </Card>

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}

