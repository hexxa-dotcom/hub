import { getTenantContext } from '@/lib/server/tenant';
import { resolveNfsePort } from '@/lib/server/container';
import { withTenant, serviceInvoice, eq, and } from '@hexxa/db';
import { redirect } from 'next/navigation';
import { XMLParser } from 'fast-xml-parser';
import DanfseLayout from './DanfseLayout';

export default async function DanfsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx.companyId) {
    redirect('/auth/login');
  }

  const [nota] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(serviceInvoice)
      .where(
        and(
          eq(serviceInvoice.id, id),
          eq(serviceInvoice.companyId, ctx.companyId)
        )
      );
  });

  if (!nota || !nota.providerProtocol) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nota Fiscal não encontrada</h1>
          <p className="text-slate-500 mt-2">Esta NFS-e não existe ou não foi processada no ambiente nacional ainda.</p>
        </div>
      </div>
    );
  }

  try {
    const port = await resolveNfsePort(ctx);
    if (!port.download) {
      throw new Error('Integration adapter does not support downloading XML');
    }

    const xmlBuffer = await port.download(nota.providerProtocol, 'xml');
    const xmlString = xmlBuffer.toString('utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });
    
    const jsonObj = parser.parse(xmlString);
    
    // O objeto raiz deve ser <NFSe> ou <DPS>
    const root = jsonObj?.NFSe || jsonObj;
    
    return <DanfseLayout data={root} notaId={id} protocol={nota.providerProtocol} />;
  } catch (err: any) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-red-600">Erro ao carregar DANFSe</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-md">{err.message}</p>
        </div>
      </div>
    );
  }
}
