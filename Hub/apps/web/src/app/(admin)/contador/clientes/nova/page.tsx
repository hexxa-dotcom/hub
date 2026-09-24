import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/server/admin-guard';
import { NovaEmpresaClient } from './NovaEmpresaClient';
import { ClientesDoNibo } from './ClientesDoNibo';
import { listarClientesDoNibo } from '@/lib/server/clientes-do-nibo';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Novo cliente | Hexx Digital' };

export default async function Page() {
  await requireAdmin();
  const clientesDoNibo = await listarClientesDoNibo().catch(() => []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <Link
          href="/contador/clientes"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A61] transition-colors hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#F5F6F4]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>
        <h1 className="mt-3 font-serif text-2xl tracking-tight text-[#231F20] dark:text-[#F5F6F4]">
          Novo cliente
        </h1>
      </div>

      <ClientesDoNibo clientes={clientesDoNibo} />
      <NovaEmpresaClient />
    </div>
  );
}
