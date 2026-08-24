import { CreditCard } from 'lucide-react';
import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, getHistoricoCobrancasAction } from './actions';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexxa',
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const plano = await getPlanoAtualAction();
  const cobrancas = await getHistoricoCobrancasAction(plano?.asaasSubscriptionId ?? null);

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <CreditCard className="h-3.5 w-3.5" />
              Assinatura & Faturamento
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Meu Plano & Pagamentos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Seu contrato contábil ativo e o histórico consolidado de faturas do Asaas.
          </p>
        </div>
      </header>

      <MeuPlanoClient plano={plano} cobrancas={cobrancas} />
    </div>
  );
}

