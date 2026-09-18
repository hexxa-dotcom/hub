import type { Metadata } from 'next';
import { listarFilas } from './actions';
import { FilasClient } from './FilasClient';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

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
      <Card level={2} tone="deep" className="relative z-30 card-finish p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              O que a IA fez
            </h1>
            <SectionInfo
              title="Sobre O que a IA fez"
              description="Tudo o que os agentes inteligentes propuseram ou aplicaram, com a evidência detalhada que sustenta cada decisão contábil."
            />
          </div>
        </div>
      </Card>

      <FilasClient inicial={filas} />
    </div>
  );
}
