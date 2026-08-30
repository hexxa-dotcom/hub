import { NextResponse } from 'next/server';
import { getDb, withDbTimeout } from '@hexxa/db';
import { serviceInvoice, company } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { makeServiceInvoiceServiceReadOnly } from '@/lib/server/container';
import type { TenantContext } from '@hexxa/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Notas de serviço (NFSe) emitidas pelo Emissor Nacional podem voltar com
 * HTTP 202 (status ISSUING) quando o processamento é assíncrono — sem esse
 * cron elas ficam "presas" em ISSUING até alguém clicar manualmente em
 * "Consultar status" na tela. Este job consulta o provedor para cada nota
 * pendente e atualiza status/número, cancelando o recebível financeiro se o
 * resultado vier como erro/cancelado.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  try {
    const pending = await withDbTimeout(
      db
        .select({
          id: serviceInvoice.id,
          companyId: serviceInvoice.companyId,
          providerProtocol: serviceInvoice.providerProtocol,
          companyType: company.type,
        })
        .from(serviceInvoice)
        .innerJoin(company, eq(serviceInvoice.companyId, company.id))
        .where(eq(serviceInvoice.status, 'ISSUING')),
      8000,
    );

    let checked = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of pending) {
      if (!row.providerProtocol) continue;
      checked++;
      try {
        const ctx: TenantContext = {
          companyId: row.companyId,
          companyType: row.companyType as TenantContext['companyType'],
          userId: 'cron',
        };
        const service = await makeServiceInvoiceServiceReadOnly(ctx);
        const newStatus = await service.refreshStatus(ctx, row.id, row.providerProtocol);
        if (newStatus !== 'ISSUING') updated++;
      } catch (err: any) {
        errors.push(`Nota ${row.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Status de NFSe verificado: ${checked} nota(s) em processamento consultada(s), ${updated} atualizada(s).`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de Status de NFSe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
