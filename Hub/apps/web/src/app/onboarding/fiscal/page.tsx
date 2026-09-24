import { getTenantContext } from '@/lib/server/tenant';
import { getPrimeirosPassos } from '@/lib/server/primeiros-passos';
import { PassosDoOnboarding } from '../PassosDoOnboarding';
import { FiscalOnboardingForm } from './FiscalOnboardingForm';
import { lerFiscal } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sua nota fiscal · Hexx Digital' };

export default async function Page() {
  const ctx = await getTenantContext();
  const [passos, dados] = await Promise.all([getPrimeirosPassos(ctx), lerFiscal()]);

  return (
    <div>
      <PassosDoOnboarding passos={passos.passos} atual="fiscal" />
      <FiscalOnboardingForm dados={dados} />
    </div>
  );
}
