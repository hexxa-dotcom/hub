import { NextResponse } from 'next/server';
import { getDb, withDbTimeout } from '@hexxa/db';
import { recurringExpense, financialEntry, category } from '@hexxa/db/schema';
import { eq, and, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Gera o lançamento PAYABLE do mês corrente pra cada despesa fixa ativa
 * (aluguel, softwares, mensalidades) que ainda não gerou este mês —
 * idempotente via `last_generated_month`, então rodar mais de uma vez no
 * mesmo mês não duplica nada.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const today = new Date();
  const refMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const active = await withDbTimeout(
      db
        .select()
        .from(recurringExpense)
        .where(and(eq(recurringExpense.active, true), lte(recurringExpense.startMonth, refMonth))),
      8000,
    );

    let generated = 0;
    const errors: string[] = [];

    for (const r of active) {
      try {
        if (r.endMonth && refMonth > r.endMonth) continue;
        if (r.lastGeneratedMonth === refMonth) continue; // já gerado este mês

        const dueDate = new Date(today.getFullYear(), today.getMonth(), r.dueDay).toISOString().slice(0, 10);

        let categoryId: string | null = null;
        if (r.categoryName) {
          const [existingCat] = await withDbTimeout(
            db
              .select({ id: category.id })
              .from(category)
              .where(and(eq(category.companyId, r.companyId), eq(category.name, r.categoryName), eq(category.kind, 'EXPENSE'))),
            8000,
          );
          categoryId = existingCat
            ? existingCat.id
            : (
                await withDbTimeout(
                  db
                    .insert(category)
                    .values({ companyId: r.companyId, name: r.categoryName, kind: 'EXPENSE' })
                    .returning({ id: category.id }),
                  8000,
                )
              )[0]!.id;
        }

        await withDbTimeout(
          db.insert(financialEntry).values({
            companyId: r.companyId,
            type: (r as any).type || 'PAYABLE', // Handle old schema and new schema
            status: 'PENDING',
            description: r.description,
            amount: r.amount,
            dueDate,
            referenceMonth: refMonth,
            source: 'RECURRING',
            sourceId: r.id,
            categoryId,
          }),
          8000,
        );

        await withDbTimeout(db.update(recurringExpense).set({ lastGeneratedMonth: refMonth }).where(eq(recurringExpense.id, r.id)), 8000);
        generated++;
      } catch (err: any) {
        errors.push(`Despesa fixa ${r.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Despesas fixas processadas: ${generated} lançamento(s) gerado(s) para ${refMonth}.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de Despesas Fixas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
