'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc, sql } from '@hexxa/db';
import { customer, contract, crmTask } from '@hexxa/db/schema';

export type RelContractRow = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  tipo: string;
  inicio: string;
  fim: string | null;
  valor: number;
  observacoes: string | null;
  status: 'ativo' | 'rascunho' | 'expirado' | 'renovar';
};

export type SaveRelContractState = { ok: boolean; message: string };

/** Cria contrato real na tabela `contract`. Se o cliente não existir ainda, cadastra pelo nome digitado. */
export async function createRelContractAction(input: {
  clienteId: string | null;
  clienteNome: string;
  tipo: string;
  valor: number;
  inicio: string;
  fim: string;
  observacoes: string;
}): Promise<SaveRelContractState> {
  const ctx = await getTenantContext();

  await withTenant(ctx.companyId, async (tx) => {
    let customerId = input.clienteId;

    if (!customerId) {
      const [created] = await tx
        .insert(customer)
        .values({ companyId: ctx.companyId, name: input.clienteNome, type: 'PJ' })
        .returning({ id: customer.id });
      customerId = created!.id;
    }

    await tx.insert(contract).values({
      companyId: ctx.companyId,
      customerId,
      title: input.tipo,
      value: String(input.valor || 0),
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      // Primeira cobrança no início do contrato — o cron de cobrança
      // (api/cron/cobranca) avança essa data a cada ciclo faturado.
      nextBillingDate: input.inicio || null,
      endDate: input.fim || null,
      notes: input.observacoes || null,
    });
  });

  revalidatePath('/relacionamento');
  return { ok: true, message: 'Contrato cadastrado.' };
}

export async function deleteRelContractAction(id: string): Promise<SaveRelContractState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(contract).where(and(eq(contract.id, id), eq(contract.companyId, ctx.companyId)));
  });
  revalidatePath('/relacionamento');
  return { ok: true, message: 'Contrato removido.' };
}

export type TarefaStatus = 'pendente' | 'em_andamento' | 'concluida';
export type TarefaPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

export type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  clienteNome: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string | null;
  criadaEm: string;
};

export async function listTarefasAction(): Promise<TarefaRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(crmTask).where(eq(crmTask.companyId, ctx.companyId)).orderBy(desc(crmTask.createdAt));
  });
  return rows.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    clienteNome: t.clienteNome,
    status: t.status as TarefaStatus,
    prioridade: t.prioridade as TarefaPrioridade,
    prazo: t.prazo,
    criadaEm: t.createdAt.toISOString().slice(0, 10),
  }));
}

export async function createTarefaAction(input: {
  titulo: string;
  descricao: string | null;
  clienteNome: string | null;
  prioridade: TarefaPrioridade;
  prazo: string | null;
}): Promise<SaveRelContractState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(crmTask).values({
      companyId: ctx.companyId,
      titulo: input.titulo,
      descricao: input.descricao,
      clienteNome: input.clienteNome,
      prioridade: input.prioridade,
      prazo: input.prazo,
    });
  });
  revalidatePath('/relacionamento');
  return { ok: true, message: 'Tarefa criada.' };
}

export async function updateTarefaStatusAction(id: string, status: TarefaStatus): Promise<SaveRelContractState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(crmTask).set({ status }).where(and(eq(crmTask.id, id), eq(crmTask.companyId, ctx.companyId)));
  });
  revalidatePath('/relacionamento');
  return { ok: true, message: 'Status atualizado.' };
}

export async function deleteTarefaAction(id: string): Promise<SaveRelContractState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(crmTask).where(and(eq(crmTask.id, id), eq(crmTask.companyId, ctx.companyId)));
  });
  revalidatePath('/relacionamento');
  return { ok: true, message: 'Tarefa removida.' };
}

/**
 * Salva um cliente (novo ou existente). O documento é guardado só com
 * dígitos — é por ele que o cliente se liga às notas e aos contratos — e não
 * pode repetir dentro da empresa.
 */
export async function salvarClienteAction(input: {
  id?: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
}): Promise<{ ok: boolean; message: string; id?: string }> {
  const ctx = await getTenantContext();
  const nome = input.nome.trim();
  const doc = input.documento.replace(/\D/g, '');
  if (!nome) return { ok: false, message: 'Informe o nome.' };
  if (doc && doc.length !== 11 && doc.length !== 14) return { ok: false, message: 'CPF ou CNPJ incompleto.' };
  return withTenant(ctx.companyId, async (tx) => {
    if (doc) {
      const [repetido] = (await tx.execute(sql`
        SELECT id FROM customer WHERE company_id = ${ctx.companyId}
           AND regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ${doc}
           AND id <> ${input.id ?? '00000000-0000-0000-0000-000000000000'}::uuid
      `)) as unknown as { id: string }[];
      if (repetido) return { ok: false, message: 'Já existe um cliente com esse documento.', id: repetido.id };
    }
    const valores = {
      name: nome,
      document: doc || null,
      email: input.email.trim() || null,
      phone: input.telefone.replace(/\D/g, '') || null,
      address: input.endereco.trim() || null,
      type: doc.length === 11 ? 'PF' : 'PJ',
    };
    if (input.id) {
      await tx.update(customer).set(valores).where(and(eq(customer.id, input.id), eq(customer.companyId, ctx.companyId)));
      revalidatePath('/relacionamento');
      revalidatePath(`/relacionamento/${input.id}`);
      return { ok: true, message: 'Cliente atualizado.', id: input.id };
    }
    const [novo] = await tx.insert(customer).values({ ...valores, companyId: ctx.companyId }).returning({ id: customer.id });
    revalidatePath('/relacionamento');
    return { ok: true, message: 'Cliente cadastrado.', id: novo!.id };
  });
}
