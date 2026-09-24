import { requireAdmin } from '@/lib/server/admin-guard';
import { carregarFila } from './actions';
import { RevisaoClient } from './RevisaoClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revisão da IA | Hexx Digital' };

export default async function Page() {
  await requireAdmin();
  const { itens, categorias } = await carregarFila();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">
          Revisão da IA
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          O que a IA classificou sozinha, de todos os clientes, agrupado pelo que ela decidiu. Um
          grupo inteiro se confere numa olhada; o que destoa, você corrige ali mesmo — e a correção
          vai para o razão, por estorno, e ensina o agente da próxima vez.
        </p>
      </div>
      <RevisaoClient itens={itens} categorias={categorias} />
    </div>
  );
}
