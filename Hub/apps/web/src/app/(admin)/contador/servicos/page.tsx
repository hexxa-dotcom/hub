import { requireAdmin } from '@/lib/server/admin-guard';
import { listarCatalogo } from '@/lib/server/servicos';
import { CatalogoDoEscritorio } from './CatalogoDoEscritorio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Serviços e preços | Hexx Digital' };

export default async function Page() {
  await requireAdmin();
  const catalogo = await listarCatalogo(true);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">Serviços e preços</h1>
        <p className="text-sm text-[#6E6A61] dark:text-[#A8A49C]">
          O catálogo de Serviços Adicionais que os clientes veem. Defina o preço de cada um — incluso no plano, a partir de um valor, um valor
          fixo ou sob orçamento — e desligue o que o escritório não faz.
        </p>
      </div>
      <CatalogoDoEscritorio catalogo={catalogo} />
    </div>
  );
}
