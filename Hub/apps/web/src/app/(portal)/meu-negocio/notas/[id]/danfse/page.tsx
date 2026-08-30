import { getTenantContext } from '@/lib/server/tenant';
import { resolveNfsePort } from '@/lib/server/container';
import { withTenant, serviceInvoice, eq, and } from '@hexxa/db';
import { redirect } from 'next/navigation';
import { parseNfseXml } from '@/lib/server/danfse';
import { generateNfseQrCode } from '@/lib/server/qrcode';
import DanfseLayout from './DanfseLayout';

export default async function DanfsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  if (!ctx.companyId) {
    redirect('/auth/login' as any);
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
    const data = parseNfseXml(xmlBuffer.toString('utf-8'), nota.providerProtocol);
    const qrDataUrl = await generateNfseQrCode(data.chaveAcesso);

    return <DanfseLayout data={data} qrDataUrl={qrDataUrl} />;
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
