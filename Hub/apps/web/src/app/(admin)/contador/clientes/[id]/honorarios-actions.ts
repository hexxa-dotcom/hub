'use server';

import { getDb, eq } from '@hexxa/db';
import { subscription, plan } from '@hexxa/db/schema';
import { valorDosHonorarios } from '@hexxa/core';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Plano e preço do cliente, num ato só.
 *
 * São duas formas de acordo, e cada uma tem a sua conta:
 *
 * - **Abatimento** sobre a tabela: "R$ 100 a menos", qualquer que seja o
 *   plano. A fatura mostra os dois — preço cheio e abatimento — para que o
 *   cliente veja o benefício, e para que um reajuste da tabela não dependa de
 *   alguém lembrar de recalcular cada cliente antigo.
 * - **Valor combinado** (plano Personalizado): o honorário é aquele número.
 *   Não é tabela nem desconto, e não sobe quando a tabela sobe.
 *
 * Um exclui o outro: gravar os dois deixaria dois preços no cadastro, e a
 * fatura escolheria um deles sem ninguém saber qual.
 */
export async function definirHonorarios(
  companyId: string,
  planId: string,
  desconto: number,
  motivo: string,
  /** Preenchido só no plano Personalizado. */
  valorCombinado?: number | null,
): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const db = getDb();

  const [p] = await db.select().from(plan).where(eq(plan.id, planId));
  if (!p) return { ok: false, mensagem: 'Plano não encontrado.' };

  const personalizado = p.name === 'Personalizado';
  const combinado = personalizado ? Number(valorCombinado) : NaN;

  if (personalizado) {
    if (!Number.isFinite(combinado) || combinado <= 0) {
      return { ok: false, mensagem: 'Informe o valor combinado com este cliente.' };
    }
  } else {
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
  }

  const dados = personalizado
    ? {
        planId: p.id,
        customValue: combinado.toFixed(2),
        // O que o acordo combinado substitui tem que sair do cadastro, senão
        // ficam dois preços guardados para o mesmo cliente.
        discountValue: '0',
        discountReason: motivo.trim() || null,
      }
    : {
        planId: p.id,
        customValue: null,
        discountValue: (Number(desconto) || 0).toFixed(2),
        discountReason: Number(desconto) > 0 ? motivo.trim() : null,
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

  const final = valorDosHonorarios({
    valorDoPlano: Number(p.monthlyValue),
    desconto: Number(dados.discountValue),
    valorCombinado: dados.customValue,
  });
  return {
    ok: true,
    mensagem: `${p.name}: ${final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês.`,
  };
}
