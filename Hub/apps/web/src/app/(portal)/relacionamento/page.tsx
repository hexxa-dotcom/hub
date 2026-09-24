import { getTenantContext } from '@/lib/server/tenant';
import { listarClientes } from '@/lib/server/clientes';
import { SectionHero } from '@/components/ui/SectionHero';
import { listTarefasAction } from './actions';
import { ClientesClient } from './ClientesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes · Hexx Digital' };

export default async function Page() {
  const ctx = await getTenantContext();
  const [clientes, tarefas] = await Promise.all([listarClientes(ctx), listTarefasAction()]);
  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title="Clientes"
        subtitulo="Quem compra de você, e tudo o que você tem com cada um"
        infoTitle="Sobre os clientes"
        infoDescription="Os clientes aparecem sozinhos a partir das notas emitidas. A ficha de cada um junta o faturamento, as notas, os contratos, o que ele tem a pagar, as propostas e as tarefas."
      />
      <ClientesClient clientes={clientes} tarefas={tarefas} />
    </div>
  );
}
