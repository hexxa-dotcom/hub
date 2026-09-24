import { getTenantContext } from '@/lib/server/tenant';
import { getPrimeirosPassos } from '@/lib/server/primeiros-passos';
import { PassosDoOnboarding } from '../PassosDoOnboarding';
import { PontoDePartidaForm } from './PontoDePartidaForm';
import { lerPontoDePartida } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'De onde você está partindo · Hexx Digital' };

export default async function Page() {
  const ctx = await getTenantContext();
  const [passos, atual] = await Promise.all([getPrimeirosPassos(ctx), lerPontoDePartida()]);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  return (
    <div>
      <PassosDoOnboarding passos={passos.passos} atual="ponto-de-partida" />
      <PontoDePartidaForm hoje={hoje} saldoAtual={atual.saldo} faturamentoAtual={atual.faturamento} />
    </div>
  );
}
