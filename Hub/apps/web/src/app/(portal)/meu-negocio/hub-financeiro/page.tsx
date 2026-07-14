import { BarChart3 } from 'lucide-react';
import { HubFinanceiro } from './HubFinanceiro';

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Hub Financeiro</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Contas a pagar, a receber e conciliação — tudo em um só lugar.
        </p>
      </header>

      <HubFinanceiro />
    </div>
  );
}
