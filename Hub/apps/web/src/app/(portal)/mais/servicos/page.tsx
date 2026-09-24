import { SectionHero } from '@/components/ui/SectionHero';
import { getTenantContext } from '@/lib/server/tenant';
import { listarCatalogo, listarPedidos } from '@/lib/server/servicos';
import { HubServicos } from './HubServicos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Serviços Adicionais · Hexx Digital' };

export default async function Page({ searchParams }: { searchParams: Promise<{ pedir?: string }> }) {
  const ctx = await getTenantContext();
  const [catalogo, pedidos, { pedir }] = await Promise.all([listarCatalogo(), listarPedidos(ctx), searchParams]);
  const abertos = pedidos.filter((p) => p.situacao !== 'CONCLUIDO' && p.situacao !== 'CANCELADO').length;

  return (
    <div className="w-full space-y-16 pb-20">
      <SectionHero
        title="Serviços Adicionais"
        subtitulo={abertos ? `${abertos} ${abertos === 1 ? 'pedido em andamento' : 'pedidos em andamento'}` : 'Peça à contabilidade o que vai além da rotina'}
        infoTitle="Sobre os Serviços Adicionais"
        infoDescription="Alterações na empresa, certidões, parcelamentos, pessoal e consultoria. Você vê o preço antes de pedir, acompanha cada pedido pelo protocolo e conversa com a contabilidade por aqui, com anexos. O que a contabilidade enviar vai também para os Documentos da Empresa."
      />
      <HubServicos catalogo={catalogo} pedidos={pedidos} pedirInicial={pedir ?? null} />
    </div>
  );
}
