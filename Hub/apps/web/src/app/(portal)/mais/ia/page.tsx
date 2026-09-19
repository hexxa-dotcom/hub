import type { Metadata } from 'next';
import { listarFilas } from './actions';
import { FilasClient } from './FilasClient';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata: Metadata = { title: 'O que a IA fez · Hexxa Hub' };
export const dynamic = 'force-dynamic';

export default async function IaPage() {
  let filas: Awaited<ReturnType<typeof listarFilas>> = { aprovacao: [], revisao: [], categorias: [] };
  try {
    filas = await listarFilas();
  } catch (err) {
    console.error('[mais/ia] falha ao carregar filas:', err);
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre O que a IA fez"
            description="Tudo o que os agentes inteligentes propuseram ou aplicaram, com a evidência detalhada que sustenta cada decisão contábil."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              O que a IA fez
            </h1>
          </div>
        </div>
      </Card>

      <FilasClient inicial={filas} />
    </div>
  );
}
