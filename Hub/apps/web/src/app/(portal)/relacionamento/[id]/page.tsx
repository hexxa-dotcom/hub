import { notFound } from 'next/navigation';
import { nomeDeExibicao } from '@/lib/nome-de-exibicao';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { fichaDoCliente, listarClientes } from '@/lib/server/clientes';
import { relacaoDoCliente, ROTULO_DA_RELACAO } from '@/lib/relacao-cliente';
import { MarcaDeRecorrencia } from '../ClientesClient';
import { SectionHero } from '@/components/ui/SectionHero';
import { FichaClient } from './FichaClient';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getTenantContext();
  const [ficha, todos] = await Promise.all([fichaDoCliente(ctx, id), listarClientes(ctx)]);
  if (!ficha) notFound();
  const resumo = todos.find((c) => c.id === id);
  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title={nomeDeExibicao(ficha.cliente.nome)}
        subtitulo={`${ficha.cliente.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}${resumo ? ` · cliente ${ROTULO_DA_RELACAO[relacaoDoCliente(resumo)].toLowerCase()}` : ''}`}
        infoTitle="Sobre a ficha do cliente"
        infoDescription="Tudo o que a empresa tem com este cliente: notas, contratos, o que ele tem a pagar, propostas e tarefas. As notas e os contratos são ligados pelo CPF ou CNPJ."
        rightSlot={
          <Link href="/relacionamento" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Clientes
          </Link>
        }
      />
      {resumo && (
        <div className="text-sm">
          <MarcaDeRecorrencia cliente={resumo} />
        </div>
      )}
      <FichaClient ficha={ficha} />
    </div>
  );
}
