import { NextResponse } from 'next/server';
import { withTenant, eq, and } from '@hexxa/db';
import { serviceInvoice } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const ctx = await getTenantContext();
    const rows = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ amount: serviceInvoice.amount, referenceMonth: serviceInvoice.referenceMonth })
        .from(serviceInvoice)
        .where(and(eq(serviceInvoice.companyId, ctx.companyId), eq(serviceInvoice.status, 'ISSUED')));
    });

    const thisMonth = rows.filter((r) => r.referenceMonth.slice(0, 7) === currentMonth);
    const total = thisMonth.reduce((s, r) => s + Number(r.amount), 0);
    return NextResponse.json({ total, count: thisMonth.length, source: 'db' });
  } catch (err) {
    console.error('[api/notas/resumo] falha ao resumir notas do mês:', err);
    // Fallback: return 0 so LucroCard still renders
    return NextResponse.json({ total: 0, count: 0, source: 'fallback' });
  }
}
