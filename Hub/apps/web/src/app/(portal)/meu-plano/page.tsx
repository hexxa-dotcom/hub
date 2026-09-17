import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, getHistoricoCobrancasAction } from './actions';

import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexxa',
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plano = await getPlanoAtualAction();
  const cobrancas = await getHistoricoCobrancasAction(plano?.asaasSubscriptionId ?? null);

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif font-bold text-display text-ink tracking-tight">
              Meu Plano & Pagamentos
            </h1>
            <p className="mt-1 text-body-sm text-ink-soft">
              Seu contrato contábil ativo e o histórico consolidado de faturas do Asaas.
            </p>
          </div>
        </div>
      </Card>

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}

