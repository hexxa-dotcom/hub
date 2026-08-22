'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { revalidatePath } from 'next/cache';

export async function getLancamentos() {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return await tx.execute(sql`
      SELECT 
        f.id, 
        f.type, 
        f.description, 
        f.amount, 
        f.due_date as vencimento,
        f.status,
        c.name as category,
        f.created_at
      FROM financial_entry f
      LEFT JOIN category c ON c.id = f.category_id
      WHERE f.company_id = ${ctx.companyId}
      ORDER BY f.due_date ASC
    `);
  });

  return data.map((row: any) => ({
    id: row.id,
    tipo: (row.type === 'PAYABLE' ? 'PAGAR' : 'RECEBER') as 'PAGAR' | 'RECEBER',
    descricao: row.description,
    valor: Number(row.amount),
    vencimento: new Date(row.vencimento).toISOString().split('T')[0]!,
    pago_em: row.status === 'PAID' ? new Date(row.vencimento).toISOString().split('T')[0]! : null,
    categoria: row.category || 'Outros',
    observacao: null,
    created_at: new Date(row.created_at).toISOString(),
    statusDb: row.status
  }));
}

export async function createLancamento(data: {
  tipo: 'PAGAR' | 'RECEBER';
  descricao: string;
  valor: number;
  vencimento: string;
  parcelas?: number;
}) {
  const ctx = await getTenantContext();
  const typeStr = data.tipo === 'PAGAR' ? 'PAYABLE' : 'RECEIVABLE';
  const total = Math.max(1, data.parcelas || 1);

  const baseDate = new Date(data.vencimento + 'T12:00:00');

  await withTenant(ctx.companyId, async (tx) => {
    for (let i = 0; i < total; i++) {
      const dueDateObj = new Date(baseDate);
      dueDateObj.setMonth(dueDateObj.getMonth() + i);
      const dueDateStr = dueDateObj.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';
      const title = total > 1 ? `${data.descricao} (${i + 1}/${total})` : data.descricao;

      await tx.execute(sql`
        INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source)
        VALUES (${ctx.companyId}, ${typeStr}, ${title}, ${data.valor.toString()}, ${dueDateStr}, ${refMonth}, 'PENDING', 'MANUAL')
      `);
    }
  });

  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/dashboard');
}

export async function updateLancamentoStatus(id: string, newStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED') {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE financial_entry 
      SET status = ${newStatus}
      WHERE id = ${id} AND company_id = ${ctx.companyId}
    `);
  });
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/dashboard');
}

export async function deleteLancamento(id: string) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      DELETE FROM financial_entry 
      WHERE id = ${id} AND company_id = ${ctx.companyId}
    `);
  });
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/dashboard');
}
