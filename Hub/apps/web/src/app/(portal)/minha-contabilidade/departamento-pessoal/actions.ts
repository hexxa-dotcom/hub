'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { employee } from '@hexxa/db/schema';

export type EmployeeRow = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  salario: number;
  vinculo: string;
  status: 'ACTIVE' | 'ON_VACATION' | 'TERMINATED';
  admissao: string | null;
  email: string | null;
};

export async function listEmployeesAction(): Promise<EmployeeRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(employee).where(eq(employee.companyId, ctx.companyId));
  });
  return rows.map((r) => ({
    id: r.id,
    nome: r.name,
    cpf: r.cpf,
    cargo: r.roleTitle,
    departamento: r.departamento,
    salario: Number(r.salary ?? 0),
    vinculo: r.vinculo,
    status: r.status,
    admissao: r.admissionDate,
    email: r.email,
  }));
}

export type SaveEmployeeState = { ok: boolean; message: string };

export async function saveEmployeeAction(input: {
  id?: string;
  nome: string;
  cpf: string;
  cargo: string;
  departamento: string;
  salario: number;
  vinculo: string;
  admissao: string;
  email: string;
}): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();

  await withTenant(ctx.companyId, async (tx) => {
    const values = {
      name: input.nome,
      cpf: input.cpf || null,
      roleTitle: input.cargo || null,
      departamento: input.departamento || null,
      salary: String(input.salario),
      vinculo: input.vinculo,
      admissionDate: input.admissao || null,
      email: input.email || null,
    };
    if (input.id) {
      await tx.update(employee).set(values).where(and(eq(employee.id, input.id), eq(employee.companyId, ctx.companyId)));
    } else {
      await tx.insert(employee).values({ companyId: ctx.companyId, ...values });
    }
  });

  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Colaborador salvo.' };
}

export async function setEmployeeStatusAction(id: string, status: 'ACTIVE' | 'ON_VACATION' | 'TERMINATED'): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(employee).set({ status }).where(and(eq(employee.id, id), eq(employee.companyId, ctx.companyId)));
  });
  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Status atualizado.' };
}

export async function deleteEmployeeAction(id: string): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(employee).where(and(eq(employee.id, id), eq(employee.companyId, ctx.companyId)));
  });
  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  return { ok: true, message: 'Colaborador removido.' };
}
