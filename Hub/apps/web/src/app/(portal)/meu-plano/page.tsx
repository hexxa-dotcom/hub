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
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Meu Plano &amp; Pagamentos
            </h1>
            <SectionInfo
              title="Sobre Meu Plano & Pagamentos"
              description="Seu contrato contábil ativo e o histórico consolidado de faturas do Asaas."
            />
          </div>
        </div>
      </Card>

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}

