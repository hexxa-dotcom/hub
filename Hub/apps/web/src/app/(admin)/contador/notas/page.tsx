export const dynamic = 'force-dynamic';
import { getDb, withDbTimeout } from '@hexxa/db/client';
import { serviceInvoice, company, customer } from '@hexxa/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NotasFiscaisTable, type NotaFiscal } from './NotasFiscaisTable';

async function getNotas(): Promise<NotaFiscal[]> {
  const db = getDb();
  const rows = await withDbTimeout(
    db
      .select({
        id: serviceInvoice.id,
        numero: serviceInvoice.nfseNumber,
        valor: serviceInvoice.amount,
        servico: serviceInvoice.serviceDescription,
        status: serviceInvoice.status,
        providerMode: serviceInvoice.providerMode,
        createdAt: serviceInvoice.createdAt,
        companyId: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        useTradeName: company.useTradeName,
        tomador: customer.name,
      })
      .from(serviceInvoice)
      .innerJoin(company, eq(serviceInvoice.companyId, company.id))
      .leftJoin(customer, eq(serviceInvoice.customerId, customer.id))
      .orderBy(desc(serviceInvoice.createdAt))
      .limit(200),
    8000,
  );

  return rows.map(r => ({
    id: r.id,
    numero: r.numero ?? '—',
    cliente: r.useTradeName && r.tradeName ? r.tradeName : r.legalName,
    companyId: r.companyId,
    tomador: r.tomador ?? '—',
    servico: r.servico,
    valor: Number(r.valor),
    emissao: r.createdAt.toISOString().slice(0, 10),
    status: r.status as NotaFiscal['status'],
    isMock: r.providerMode === 'mock',
  }));
}

export default async function AdminNotasPage() {
  let notas: NotaFiscal[] = [];
  try {
    notas = await getNotas();
  } catch (err) {
    console.error('[AdminNotasPage] falha ao carregar notas:', err);
  }
  return <NotasFiscaisTable initial={notas} />;
}
