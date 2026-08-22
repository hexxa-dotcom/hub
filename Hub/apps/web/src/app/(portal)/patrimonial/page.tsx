import { Bank } from '@phosphor-icons/react/dist/ssr';
import { getProperties, getResumoFinanceiroAction } from './actions';
import { listPartnersAction } from '../minha-contabilidade/socios/actions';
import { PatrimonioApp } from './PatrimonioApp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [properties, partners, resumo] = await Promise.all([
    getProperties(),
    listPartnersAction(),
    getResumoFinanceiroAction(),
  ]);

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <Bank className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Gestão de Patrimônio</h1>
          <p className="text-sm text-ink-soft">Patrimônio da empresa (PJ) e dos sócios (PF), com dados reais — não em achismos.</p>
        </div>
      </header>

      <PatrimonioApp initialProperties={properties} partners={partners} resumo={resumo} />
    </div>
  );
}
