import {  Receipt  } from '@phosphor-icons/react/dist/ssr';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { HubGuias } from './HubGuias';

export const dynamic = 'force-dynamic';

async function getGuias() {
  try {
    const ctx = await getTenantContext();
    return await new DrizzleTaxGuideRepository().listAll(ctx);
  } catch (err) {
    console.error('[guias/page] falha ao listar guias:', err);
    return [];
  }
}

export default async function Page() {
  const guias = await getGuias();

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Guias de Impostos</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          DAS, DARF, ISS, parcelamentos e demais guias — histórico completo com status de pagamento.
        </p>
      </header>

      <HubGuias initial={guias} />
    </div>
  );
}
