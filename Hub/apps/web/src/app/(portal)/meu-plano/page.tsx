import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, getHistoricoCobrancasAction } from './actions';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexx',
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plano = await getPlanoAtualAction();
  const cobrancas = await getHistoricoCobrancasAction(plano?.asaasSubscriptionId ?? null);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Meu Plano & Pagamentos</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Seu contrato contábil e o histórico real de cobranças, direto do Asaas.
        </p>
      </header>

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}
