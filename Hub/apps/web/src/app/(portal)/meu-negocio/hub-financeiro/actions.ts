'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, sql, type DbHandle } from '@hexxa/db';
import { category, recurringExpense, businessPartner, costCenter } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // 4MB — guarda base64 direto no banco, sem storage externo.

export async function getLancamentos() {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return await tx.execute(sql`
      SELECT
        f.id,
        f.type,
        f.description,
        f.amount,
        f.original_amount,
        f.interest,
        f.discount,
        f.due_date as vencimento,
        f.status,
        c.name as category,
        bp.name as partner_name,
        cc.name as cost_center_name,
        f.created_at,
        (f.receipt_base64 IS NOT NULL) as has_receipt,
        f.receipt_filename,
        f.source,
        f.source_id
      FROM financial_entry f
      LEFT JOIN category c ON c.id = f.category_id
      LEFT JOIN business_partner bp ON bp.id = f.partner_id
      LEFT JOIN cost_center cc ON cc.id = f.cost_center_id
      WHERE f.company_id = ${ctx.companyId} AND f.status != 'CANCELED'
      ORDER BY f.due_date ASC
    `);
  });

  return data.map((row: any) => ({
    id: row.id,
    tipo: (row.type === 'PAYABLE' ? 'PAGAR' : 'RECEBER') as 'PAGAR' | 'RECEBER',
    descricao: row.description,
    valor: Number(row.amount),
    originalAmount: row.original_amount ? Number(row.original_amount) : null,
    interest: row.interest ? Number(row.interest) : null,
    discount: row.discount ? Number(row.discount) : null,
    vencimento: new Date(row.vencimento).toISOString().split('T')[0]!,
    pago_em: row.status === 'PAID' ? new Date(row.vencimento).toISOString().split('T')[0]! : null,
    categoria: row.category || 'Outros',
    partnerName: row.partner_name as string | null,
    costCenterName: row.cost_center_name as string | null,
    observacao: null,
    created_at: new Date(row.created_at).toISOString(),
    statusDb: row.status,
    temComprovante: Boolean(row.has_receipt),
    comprovanteNome: row.receipt_filename as string | null,
    isFixa: row.source === 'RECURRING',
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
  }));
}

/** Acha (ou cria) a categoria pelo nome — é assim que o dropdown do formulário passa a persistir de verdade. */
async function getOrCreateCategoryId(
  tx: DbHandle,
  companyId: string,
  name: string,
  kind: 'INCOME' | 'EXPENSE'
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const [existing] = await tx
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.companyId, companyId), eq(category.name, trimmed), eq(category.kind, kind)));
  if (existing) return existing.id;

  const [created] = await tx.insert(category).values({ companyId, name: trimmed, kind }).returning({ id: category.id });
  return created!.id;
}

async function getOrCreateBusinessPartner(tx: DbHandle, companyId: string, name: string, type: 'CLIENT' | 'SUPPLIER'): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [existing] = await tx
    .select({ id: businessPartner.id })
    .from(businessPartner)
    .where(and(eq(businessPartner.companyId, companyId), eq(businessPartner.name, trimmed), eq(businessPartner.type, type)));
  if (existing) return existing.id;
  const [created] = await tx.insert(businessPartner).values({ companyId, name: trimmed, type }).returning({ id: businessPartner.id });
  return created!.id;
}

async function getOrCreateCostCenter(tx: DbHandle, companyId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [existing] = await tx
    .select({ id: costCenter.id })
    .from(costCenter)
    .where(and(eq(costCenter.companyId, companyId), eq(costCenter.name, trimmed)));
  if (existing) return existing.id;
  const [created] = await tx.insert(costCenter).values({ companyId, name: trimmed }).returning({ id: costCenter.id });
  return created!.id;
}

export async function createLancamento(data: {
  tipo: 'PAGAR' | 'RECEBER';
  descricao: string;
  valor: number;
  vencimento: string;
  parcelas?: number;
  isInfinite?: boolean;
  categoria?: string;
  comprovante?: File | null;
  multaJuros?: number;
  desconto?: number;
  parceiro?: string;
  centroCusto?: string;
}) {
  const ctx = await getTenantContext();
  const typeStr = data.tipo === 'PAGAR' ? 'PAYABLE' : 'RECEIVABLE';
  const total = Math.max(1, data.parcelas || 1);

  const baseDate = new Date(data.vencimento + 'T12:00:00');

  let receiptBase64: string | null = null;
  let receiptFilename: string | null = null;
  let receiptMimeType: string | null = null;
  if (data.comprovante && data.comprovante.size > 0) {
    if (data.comprovante.size > MAX_RECEIPT_BYTES) {
      throw new Error('Comprovante muito grande (máx. 4MB).');
    }
    const buf = Buffer.from(await data.comprovante.arrayBuffer());
    receiptBase64 = buf.toString('base64');
    receiptFilename = data.comprovante.name;
    receiptMimeType = data.comprovante.type || null;
  }

  await withTenant(ctx.companyId, async (tx) => {
    const categoryId = data.categoria
      ? await getOrCreateCategoryId(tx, ctx.companyId, data.categoria, data.tipo === 'PAGAR' ? 'EXPENSE' : 'INCOME')
      : null;
    
    const partnerId = data.parceiro 
      ? await getOrCreateBusinessPartner(tx, ctx.companyId, data.parceiro, data.tipo === 'PAGAR' ? 'SUPPLIER' : 'CLIENT')
      : null;

    const costCenterId = data.centroCusto
      ? await getOrCreateCostCenter(tx, ctx.companyId, data.centroCusto)
      : null;

    // Se houver multa ou desconto, o valor informado no formulário é o valor final (amount).
    // O valor original será amount - interest + discount
    const interest = data.multaJuros || 0;
    const discount = data.desconto || 0;
    const originalAmount = data.valor - interest + discount;

    if (data.isInfinite) {
      // 1. Gera o lançamento único de AGORA
      const dueDateStr = baseDate.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';

      await tx.execute(sql`
        INSERT INTO financial_entry (
          company_id, type, description, amount, original_amount, interest, discount, 
          due_date, reference_month, status, source, category_id, partner_id, cost_center_id, 
          receipt_base64, receipt_filename, receipt_mime_type
        )
        VALUES (
          ${ctx.companyId}, ${typeStr}, ${data.descricao}, ${data.valor.toString()}, 
          ${originalAmount > 0 ? originalAmount.toString() : null}, 
          ${interest > 0 ? interest.toString() : null}, 
          ${discount > 0 ? discount.toString() : null}, 
          ${dueDateStr}, ${refMonth}, 'PENDING', 'MANUAL', 
          ${categoryId}, ${partnerId}, ${costCenterId},
          ${receiptBase64}, ${receiptFilename}, ${receiptMimeType}
        )
      `);

      // 2. Cria a despesa recorrente (recurring_expense) começando no PRÓXIMO mês
      const nextMonthDate = new Date(baseDate);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonthStr = nextMonthDate.toISOString().substring(0, 8) + '01';
      const dueDay = baseDate.getDate();

      await tx.execute(sql`
        INSERT INTO recurring_expense (
          company_id, type, description, amount, category_name, due_day, start_month
        ) VALUES (
          ${ctx.companyId}, ${typeStr}, ${data.descricao}, ${data.valor.toString()},
          ${data.categoria || null}, ${dueDay}, ${nextMonthStr}
        )
      `);
    } else {
      // Cria as parcelas normais
      for (let i = 0; i < total; i++) {
        const dueDateObj = new Date(baseDate);
        dueDateObj.setMonth(dueDateObj.getMonth() + i);
        const dueDateStr = dueDateObj.toISOString().split('T')[0]!;
        const refMonth = dueDateStr.substring(0, 8) + '01';
        const title = total > 1 ? `${data.descricao} (${i + 1}/${total})` : data.descricao;

        await tx.execute(sql`
          INSERT INTO financial_entry (
            company_id, type, description, amount, original_amount, interest, discount, 
            due_date, reference_month, status, source, category_id, partner_id, cost_center_id, 
            receipt_base64, receipt_filename, receipt_mime_type
          )
          VALUES (
            ${ctx.companyId}, ${typeStr}, ${title}, ${data.valor.toString()}, 
            ${originalAmount > 0 ? originalAmount.toString() : null}, 
            ${interest > 0 ? interest.toString() : null}, 
            ${discount > 0 ? discount.toString() : null}, 
            ${dueDateStr}, ${refMonth}, 'PENDING', 'MANUAL', 
            ${categoryId}, ${partnerId}, ${costCenterId},
            ${receiptBase64}, ${receiptFilename}, ${receiptMimeType}
          )
        `);
      }
    }
  });

  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
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
  revalidatePath('/cliente');
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
  revalidatePath('/cliente');
}

/** Baixa o comprovante anexado a um lançamento (base64 → data URL, pra abrir/baixar no client). */
export async function getComprovante(id: string): Promise<{ dataUrl: string; filename: string } | null> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT receipt_base64, receipt_filename, receipt_mime_type
      FROM financial_entry
      WHERE id = ${id} AND company_id = ${ctx.companyId}
    `);
  });
  const row = rows[0] as any;
  if (!row?.receipt_base64) return null;
  const mime = row.receipt_mime_type || 'application/octet-stream';
  return { dataUrl: `data:${mime};base64,${row.receipt_base64}`, filename: row.receipt_filename || 'comprovante' };
}

// ── Despesas Fixas (recorrentes) ────────────────────────────────────────────

export type RecurringExpenseRow = {
  id: string;
  description: string;
  amount: number;
  categoryName: string | null;
  dueDay: number;
  active: boolean;
  startMonth: string;
  endMonth: string | null;
};

export async function listRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(recurringExpense)
      .where(eq(recurringExpense.companyId, ctx.companyId))
      .orderBy(recurringExpense.description);
  });
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    categoryName: r.categoryName,
    dueDay: r.dueDay,
    active: r.active,
    startMonth: r.startMonth,
    endMonth: r.endMonth,
  }));
}

/**
 * Cria a despesa fixa e já gera o lançamento do mês corrente (ou do próximo,
 * se o dia de vencimento deste mês já passou) — pra não deixar o usuário
 * esperando o cron rodar pra ver o primeiro efeito.
 */
export async function createRecurringExpense(input: {
  description: string;
  amount: number;
  categoryName: string | null;
  dueDay: number;
}) {
  if (!input.description.trim() || !(input.amount > 0) || input.dueDay < 1 || input.dueDay > 28) {
    throw new Error('Preencha descrição, valor e um dia de vencimento entre 1 e 28.');
  }

  const ctx = await getTenantContext();
  const today = new Date();
  const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  await withTenant(ctx.companyId, async (tx) => {
    const categoryId = input.categoryName
      ? await getOrCreateCategoryId(tx, ctx.companyId, input.categoryName, 'EXPENSE')
      : null;

    const [created] = await tx
      .insert(recurringExpense)
      .values({
        companyId: ctx.companyId,
        description: input.description.trim(),
        amount: String(input.amount),
        categoryName: input.categoryName,
        dueDay: input.dueDay,
        startMonth,
      })
      .returning({ id: recurringExpense.id });

    // Gera já o lançamento deste mês (ou do próximo, se o dia já passou).
    const generateForThisMonth = today.getDate() <= input.dueDay;
    const genMonthDate = new Date(today.getFullYear(), today.getMonth() + (generateForThisMonth ? 0 : 1), 1);
    const refMonth = genMonthDate.toISOString().split('T')[0]!;
    const dueDate = new Date(genMonthDate.getFullYear(), genMonthDate.getMonth(), input.dueDay)
      .toISOString()
      .split('T')[0]!;

    await tx.execute(sql`
      INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, source_id, category_id)
      VALUES (${ctx.companyId}, 'PAYABLE', ${input.description.trim()}, ${String(input.amount)}, ${dueDate}, ${refMonth}, 'PENDING', 'RECURRING', ${created!.id}, ${categoryId})
    `);
    await tx
      .update(recurringExpense)
      .set({ lastGeneratedMonth: refMonth })
      .where(eq(recurringExpense.id, created!.id));
  });

  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');
}

export async function setRecurringExpenseActive(id: string, active: boolean) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(recurringExpense)
      .set({ active })
      .where(and(eq(recurringExpense.id, id), eq(recurringExpense.companyId, ctx.companyId)));
  });
  revalidatePath('/meu-negocio/hub-financeiro');
}

/** Exclui a despesa fixa. Lançamentos já gerados no passado não são apagados. */
export async function deleteRecurringExpense(id: string) {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .delete(recurringExpense)
      .where(and(eq(recurringExpense.id, id), eq(recurringExpense.companyId, ctx.companyId)));
  });
  revalidatePath('/meu-negocio/hub-financeiro');
}
