'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant } from '@hexxa/db';
import { customer, contract } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { createCustomer as createAsaasCustomer, createSubscription as createAsaasSubscription } from '@/lib/asaas';

export type CustomerState = { ok: boolean; message: string };

export async function addCustomerAction(_prev: CustomerState, formData: FormData): Promise<CustomerState> {
  try {
    const nome = String(formData.get('nome') ?? '').trim();
    const documento = String(formData.get('documento') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim() || null;
    const valorMensalidade = String(formData.get('valorMensalidade') ?? '').trim();
    const diaVencimento = String(formData.get('diaVencimento') ?? '').trim();

    if (!nome || !documento) {
      return { ok: false, message: 'Preencha nome e documento.' };
    }

    const ctx = await getTenantContext();

    // Verifica se cliente já existe (mesmo documento) e insere o novo cliente.
    const telefone = String(formData.get('telefone') ?? '').trim() || null;
    const endereco = [
      String(formData.get('endereco') ?? '').trim(),
      String(formData.get('cidade') ?? '').trim(),
      String(formData.get('uf') ?? '').trim(),
      String(formData.get('cep') ?? '').trim(),
    ]
      .filter(Boolean)
      .join(', ') || null;
    const tipo = String(formData.get('tipo') ?? 'PJ');

    const result = await withTenant(ctx.companyId, async (tx) => {
      const existing = await tx
        .select({ id: customer.id })
        .from(customer)
        .where(and(eq(customer.companyId, ctx.companyId), eq(customer.document, documento)))
        .limit(1);

      if (existing.length > 0) {
        return { kind: 'duplicate' as const };
      }

      // 1. Inserir Cliente no banco do Hexxa Hub
      const [created] = await tx.insert(customer).values({
        companyId: ctx.companyId,
        name: nome,
        document: documento,
        email,
        phone: telefone,
        address: endereco,
        type: tipo,
      }).returning({ id: customer.id });

      if (!created) {
        return { kind: 'insert_failed' as const };
      }
      return { kind: 'ok' as const, customer: created };
    });

    if (result.kind === 'duplicate') {
      return { ok: false, message: 'Cliente com este documento já existe.' };
    }

    if (result.kind === 'insert_failed') {
      return { ok: false, message: 'Erro ao cadastrar cliente no banco.' };
    }

    const newCustomer = result.customer;

    // 2. Se informou Valor e Vencimento, criamos o contrato e a assinatura no Asaas
    if (valorMensalidade && diaVencimento) {
      const valor = Number(valorMensalidade);
      if (valor > 0) {
        // A) Criar Customer no Asaas
        const asaasCustomer = await createAsaasCustomer({
          name: nome,
          cpfCnpj: documento,
          email: email || 'cliente@sememail.com',
          phone: telefone || undefined,
        });

        // B) Criar Contrato no banco do Hexxa Hub
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(Number(diaVencimento));
        const nextDueDateStr = nextDate.toISOString().slice(0, 10);

        const [newContract] = await withTenant(ctx.companyId, async (tx) => {
          return tx.insert(contract).values({
            companyId: ctx.companyId,
            customerId: newCustomer.id,
            title: `Assessoria Contábil - ${nome}`,
            value: String(valor),
            billingCycle: 'MONTHLY',
            status: 'ACTIVE',
            nextBillingDate: nextDueDateStr,
          }).returning({ id: contract.id });
        });

        if (newContract) {
          // C) Criar Subscription no Asaas
          await createAsaasSubscription({
            customer: asaasCustomer.id,
            billingType: 'BOLETO', // Pode evoluir para escolher Pix ou Cartão
            value: valor,
            nextDueDate: nextDueDateStr,
            cycle: 'MONTHLY',
            description: `Honorários Contábeis - ${nome}`,
            externalReference: newContract.id,
          });
        }
      }
    }

    revalidatePath('/meu-negocio/clientes');
    revalidatePath('/relacionamento');
    return { ok: true, message: 'Cliente cadastrado com sucesso!' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}
