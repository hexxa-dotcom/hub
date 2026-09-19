'use server';

import { getDb, eq } from '@hexxa/db';
import { subscription, plan } from '@hexxa/db/schema';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Plano e desconto do cliente, num ato só.
 *
 * O desconto é por cliente e fica na assinatura: "R$ 100 a menos" sobre o
 * preço do plano, qualquer que ele seja. A fatura de honorários mostra os
 * dois — preço cheio e abatimento — para que o cliente veja o benefício, e
 * para que um reajuste da tabela não precise de alguém lembrar de
 * recalcular cada cliente antigo.
 */
export async function definirHonorarios(
  companyId: string,
  planId: string,
  desconto: number,
  motivo: string,
): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const db = getDb();

  const [p] = await db.select().from(plan).where(eq(plan.id, planId));
  if (!p) return { ok: false, mensagem: 'Plano não encontrado.' };

  const valor = Number(desconto) || 0;
  if (valor < 0) return { ok: false, mensagem: 'O desconto não pode ser negativo.' };
  // Desconto maior que o plano daria fatura negativa — que é pagar o cliente
  // para atendê-lo. Se for isso mesmo, é cortesia, e cortesia não é desconto.
  if (valor > Number(p.monthlyValue)) {
    return { ok: false, mensagem: `O desconto passa do valor do plano (${p.monthlyValue}).` };
  }
  if (valor > 0 && motivo.trim().length < 3) {
    return { ok: false, mensagem: 'Diga o motivo do desconto — ele aparece na fatura.' };
  }

  const dados = {
    planId: p.id,
    discountValue: valor.toFixed(2),
    discountReason: valor > 0 ? motivo.trim() : null,
  };

  const atualizadas = await db
    .update(subscription)
    .set(dados)
    .where(eq(subscription.companyId, companyId))
    .returning({ id: subscription.id });

  if (!atualizadas.length) {
    await db.insert(subscription).values({ companyId, status: 'ACTIVE', ...dados });
  }

  revalidatePath(`/contador/clientes/${companyId}`);
  revalidatePath('/contador/clientes');
  const final = Number(p.monthlyValue) - valor;
  return {
    ok: true,
    mensagem: `${p.name}: ${final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês.`,
  };
}
