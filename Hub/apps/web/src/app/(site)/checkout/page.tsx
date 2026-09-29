import type { Metadata } from 'next';
import Link from 'next/link';
import { Checkout } from '@/components/site/Checkout';
import { PLANOS, type PlanoId } from '@/lib/site/planos';

export const metadata: Metadata = { title: 'Contratar | Hexx Digital', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ plano?: string; cobranca?: string }> }) {
  const sp = await searchParams;
  const plano = (sp.plano && sp.plano in PLANOS ? sp.plano : 'simples-completo') as PlanoId;
  return (
    <div style={{ minHeight: '100vh', background: '#F3F2EE', color: '#0E0E10', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#0E0E10', color: '#F3F2EE', borderBottom: '1px solid #1C1C20' }}>
        <div className="wrap" style={{ maxWidth: 1160, paddingTop: 18, paddingBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <Link href="/" style={{ display: 'flex' }} aria-label="Hexx Digital — início"><img src="/brand/hexx-horizontal-negativo.svg" alt="hexx" style={{ height: 24, width: 'auto', display: 'block' }} /></Link>
          <div className="m" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A8A86' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B9E86B' }} />Pagamento seguro
          </div>
        </div>
      </header>
      <Checkout planoInicial={plano} cobrancaInicial={sp.cobranca === 'mensal' ? 'mensal' : 'anual'} />
    </div>
  );
}
