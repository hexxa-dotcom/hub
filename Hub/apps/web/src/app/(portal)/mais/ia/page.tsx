import type { Metadata } from 'next';
import { listarFilas } from './actions';
import { FilasClient } from './FilasClient';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = { title: 'O que a IA fez · Hexxa Hub' };
export const dynamic = 'force-dynamic';

export default async function IaPage() {
  let filas: Awaited<ReturnType<typeof listarFilas>> = { aprovacao: [], revisao: [] };
  try {
    filas = await listarFilas();
  } catch (err) {
    console.error('[mais/ia] falha ao carregar filas:', err);
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="card-finish p-6 sm:p-8">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            O que a IA fez
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Tudo o que os agentes inteligentes propuseram ou aplicaram, com a evidência detalhada que sustenta cada decisão contábil.
          </p>
        </div>
      </Card>

      <FilasClient inicial={filas} />
    </div>
  );
}
