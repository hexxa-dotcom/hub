import { Users } from '@phosphor-icons/react/dist/ssr';
import { HubSocios } from './HubSocios';
import { listPartnersAction } from './actions';
import { listDistributionsAction } from '../distribuicao-lucros/actions';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, proLaboreMinimoParaFatorR } from '@/lib/server/fiscal';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getTenantContext();
  const [partners, distribuicoes, simplesInputs] = await Promise.all([
    listPartnersAction(),
    listDistributionsAction(),
    getSimplesInputs(ctx),
  ]);

  const prolaboreMinimoRecomendado = proLaboreMinimoParaFatorR(simplesInputs.rbt12, simplesInputs.folhaEmpregados12);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sócios</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie o pró-labore e a distribuição de lucros dos sócios da empresa.
        </p>
      </header>

      <HubSocios
        initialPartners={partners}
        initialDistribuicoes={distribuicoes}
        prolaboreMinimoRecomendado={prolaboreMinimoRecomendado}
        prolaboreAtualTotal={simplesInputs.prolabore12 / 12}
        fatorRFavoravel={simplesInputs.rbt12 > 0 ? simplesInputs.folha12 / simplesInputs.rbt12 >= 0.28 : true}
      />
    </div>
  );
}
