import { getTenantContext } from '@/lib/server/tenant';
import { getPrimeirosPassos } from '@/lib/server/primeiros-passos';
import { PassosDoOnboarding } from '../PassosDoOnboarding';
import { FiscalOnboardingForm } from './FiscalOnboardingForm';
import { lerFiscal } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sua nota fiscal · Hexxa Hub' };

export default async function Page() {
  const ctx = await getTenantContext();
  const [passos, dados] = await Promise.all([getPrimeirosPassos(ctx), lerFiscal()]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 p-4 py-10">
      <PassosDoOnboarding passos={passos.passos} atual="fiscal" />
      <FiscalOnboardingForm dados={dados} />
    </div>
  );
}
