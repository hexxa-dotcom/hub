import { NextResponse } from 'next/server';
import { getDb } from '@hexxa/db';
import { contract, financialEntry } from '@hexxa/db/schema';
import { eq, and, lte, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Motor de cobrança recorrente — sem movimentar dinheiro real (nenhuma
 * cobrança via gateway de pagamento). Só faz o que já deveria acontecer
 * sozinho: gerar o contas a receber de cada contrato ativo quando chega a
 * data, e marcar como vencido quem passou do prazo sem pagamento. Antes
 * disso, `nextBillingDate` era gravado no contrato e nunca lido em lugar
 * nenhum — cobrança dependia 100% de alguém lançar manualmente no
 * Financeiro.
 */

function addCycle(dateStr: string, cycle: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  switch (cycle) {
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'SEMIANNUAL': d.setMonth(d.getMonth() + 6); break;
    case 'ANNUAL': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1); break; // MONTHLY
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    // 1) Marca como vencido quem passou do prazo e ainda está pendente.
    const overdue = await db
      .update(financialEntry)
      .set({ status: 'OVERDUE' })
      .where(and(eq(financialEntry.status, 'PENDING'), lt(financialEntry.dueDate, todayStr)))
      .returning({ id: financialEntry.id });

    // 2) Gera a parcela de contratos ativos cuja próxima cobrança já chegou.
    const dueContracts = await db
      .select()
      .from(contract)
      .where(and(eq(contract.status, 'ACTIVE'), lte(contract.nextBillingDate, todayStr)));

    let generated = 0;
    let finished = 0;
    const errors: string[] = [];

    for (const c of dueContracts) {
      try {
        if (!c.nextBillingDate) continue;

        // Idempotência: não gera de novo se já existe lançamento deste
        // contrato pra este vencimento (cron pode rodar mais de uma vez).
        const [already] = await db
          .select({ id: financialEntry.id })
          .from(financialEntry)
          .where(
            and(
              eq(financialEntry.source, 'CONTRACT'),
              eq(financialEntry.sourceId, c.id),
              eq(financialEntry.dueDate, c.nextBillingDate),
            ),
          );

        if (!already) {
          const referenceMonth = c.nextBillingDate.slice(0, 8) + '01';
          await db.insert(financialEntry).values({
            companyId: c.companyId,
            type: 'RECEIVABLE',
            status: 'PENDING',
            description: `Recebível — ${c.title}`,
            amount: c.value,
            dueDate: c.nextBillingDate,
            referenceMonth,
            source: 'CONTRACT',
            sourceId: c.id,
          });
          generated++;
        }

        const next = addCycle(c.nextBillingDate, c.billingCycle);

        if (c.endDate && next > c.endDate) {
          await db.update(contract).set({ status: 'FINISHED', nextBillingDate: null }).where(eq(contract.id, c.id));
          finished++;
        } else {
          await db.update(contract).set({ nextBillingDate: next }).where(eq(contract.id, c.id));
        }
      } catch (err: any) {
        errors.push(`Contrato ${c.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Cobrança processada: ${generated} recebível(is) gerado(s), ${overdue.length} marcado(s) como vencido(s), ${finished} contrato(s) encerrado(s).`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron de Cobrança:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
