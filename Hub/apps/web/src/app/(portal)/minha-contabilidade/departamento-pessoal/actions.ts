'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc, sql } from '@hexxa/db';
import { employee, vacationPeriod, payslip, financialEntry } from '@hexxa/db/schema';
import { createContractAction } from '../../meu-negocio/contratos/actions';

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
  cnpj: string | null;
  vigenciaFim: string | null;
  vencimentoDia: number | null;
  businessContractId: string | null;
};

function toRow(r: typeof employee.$inferSelect): EmployeeRow {
  return {
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
    cnpj: r.cnpj,
    vigenciaFim: r.contractEndDate,
    vencimentoDia: r.paymentDueDay,
    businessContractId: r.businessContractId,
  };
}

export async function listEmployeesAction(): Promise<EmployeeRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(employee).where(eq(employee.companyId, ctx.companyId));
  });
  return rows.map(toRow);
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
  cnpj?: string;
  vigenciaFim?: string;
  vencimentoDia?: number;
}): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  const isPJ = input.vinculo === 'PJ';

  const values = {
    name: input.nome,
    cpf: input.cpf || null,
    roleTitle: input.cargo || null,
    departamento: input.departamento || null,
    salary: String(input.salario),
    vinculo: input.vinculo,
    admissionDate: input.admissao || null,
    email: input.email || null,
    cnpj: isPJ ? input.cnpj || null : null,
    contractEndDate: isPJ ? input.vigenciaFim || null : null,
    paymentDueDay: isPJ ? input.vencimentoDia || null : null,
  };

  if (input.id) {
    await withTenant(ctx.companyId, async (tx) => {
      await tx.update(employee).set(values).where(and(eq(employee.id, input.id!), eq(employee.companyId, ctx.companyId)));
    });
  } else {
    const [inserted] = await withTenant(ctx.companyId, async (tx) => {
      return tx.insert(employee).values({ companyId: ctx.companyId, ...values }).returning({ id: employee.id });
    });

    // PJ com valor, vencimento e vigência completos: gera o contrato de
    // pagamento recorrente automaticamente (reaproveita a mesma máquina de
    // /meu-negocio/contratos — cria os lançamentos PAYABLE mês a mês).
    if (isPJ && inserted && input.salario > 0 && input.vigenciaFim && input.vencimentoDia && input.admissao) {
      const contractResult = await createContractAction({
        type: 'SAIDA',
        title: `Colaborador PJ — ${input.cargo || 'Prestação de serviço'}`,
        partyName: input.nome,
        partyCnpj: input.cnpj,
        value: input.salario,
        dueDay: input.vencimentoDia,
        startDate: input.admissao,
        endDate: input.vigenciaFim,
        autoEmitNfse: false,
      });
      if (contractResult.ok) {
        // Acha o contrato recém-criado pra linkar no colaborador (createContractAction não retorna o id).
        const [contract] = await withTenant(ctx.companyId, async (tx) => {
          return tx.execute(sql`
            SELECT id FROM business_contract
            WHERE company_id = ${ctx.companyId} AND party_name = ${input.nome}
            ORDER BY created_at DESC LIMIT 1
          `);
        });
        if (contract?.id) {
          await withTenant(ctx.companyId, async (tx) => {
            await tx.update(employee).set({ businessContractId: contract.id as string }).where(eq(employee.id, inserted.id));
          });
        }
      }
    }
  }

  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/cliente');
  return {
    ok: true,
    message: isPJ && !input.id
      ? 'Colaborador PJ salvo — contrato de pagamento recorrente gerado em Contratos & Assinaturas.'
      : 'Colaborador salvo.',
  };
}

export async function setEmployeeStatusAction(id: string, status: 'ACTIVE' | 'ON_VACATION' | 'TERMINATED'): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.update(employee).set({ status }).where(and(eq(employee.id, id), eq(employee.companyId, ctx.companyId)));
  });
  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/minha-contabilidade/termometro-tributario');
  revalidatePath('/cliente');
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

// ── Férias ────────────────────────────────────────────────────────────────────

export type VacationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
};

export async function listVacationPeriodsAction(): Promise<VacationRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT v.id, v.employee_id, e.name AS employee_name, v.start_date, v.end_date
      FROM vacation_period v
      JOIN employee e ON e.id = v.employee_id
      WHERE e.company_id = ${ctx.companyId}
      ORDER BY v.start_date DESC
    `);
  });
  return rows.map((r: any) => ({
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

export async function addVacationPeriodAction(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
}): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  if (!input.employeeId || !input.startDate || !input.endDate) {
    return { ok: false, message: 'Preencha colaborador, início e fim.' };
  }

  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(vacationPeriod).values({
      employeeId: input.employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    await tx
      .update(employee)
      .set({ status: 'ON_VACATION' })
      .where(and(eq(employee.id, input.employeeId), eq(employee.companyId, ctx.companyId)));
  });

  revalidatePath('/minha-contabilidade/departamento-pessoal');
  return { ok: true, message: 'Férias registradas.' };
}

export async function deleteVacationPeriodAction(id: string): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      DELETE FROM vacation_period
      WHERE id = ${id} AND employee_id IN (SELECT id FROM employee WHERE company_id = ${ctx.companyId})
    `);
  });
  revalidatePath('/minha-contabilidade/departamento-pessoal');
  return { ok: true, message: 'Período removido.' };
}

// ── Folha de Pagamento ───────────────────────────────────────────────────────

export type PayslipRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  referenceMonth: string;
  netAmount: number;
};

export async function listPayslipsAction(): Promise<PayslipRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT p.id, p.employee_id, e.name AS employee_name, p.reference_month, p.net_amount
      FROM payslip p
      JOIN employee e ON e.id = p.employee_id
      WHERE e.company_id = ${ctx.companyId}
      ORDER BY p.reference_month DESC, e.name ASC
    `);
  });
  return rows.map((r: any) => ({
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    referenceMonth: r.reference_month,
    netAmount: Number(r.net_amount),
  }));
}

/**
 * Gera a folha do mês pra todo mundo com vínculo CLT/Estagiário ativo (PJ
 * paga via contrato/NFSe, Sócio via pró-labore — cada um já tem seu próprio
 * fluxo). Não duplica quem já tem holerite gerado no mês.
 */
export async function generatePayslipsAction(referenceMonth: string): Promise<SaveEmployeeState> {
  const ctx = await getTenantContext();
  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) return { ok: false, message: 'Mês inválido.' };
  const refDate = `${referenceMonth}-01`;
  const dueDate = `${referenceMonth}-05`;

  const elegiveis = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(employee)
      .where(and(eq(employee.companyId, ctx.companyId), eq(employee.status, 'ACTIVE')));
  });

  const alvo = elegiveis.filter((e) => e.vinculo === 'CLT' || e.vinculo === 'Estagiario');
  if (alvo.length === 0) return { ok: false, message: 'Nenhum colaborador CLT/Estagiário ativo pra gerar folha.' };

  let gerados = 0;
  await withTenant(ctx.companyId, async (tx) => {
    for (const e of alvo) {
      const existing = await tx
        .select({ id: payslip.id })
        .from(payslip)
        .where(and(eq(payslip.employeeId, e.id), eq(payslip.referenceMonth, refDate)));
      if (existing.length > 0) continue;

      const amount = Number(e.salary ?? 0);
      if (amount <= 0) continue;

      await tx.insert(payslip).values({
        employeeId: e.id,
        referenceMonth: refDate,
        netAmount: String(amount),
      });

      await tx.insert(financialEntry).values({
        companyId: ctx.companyId,
        type: 'PAYABLE',
        status: 'PENDING',
        description: `Folha de Pagamento — ${e.name}`,
        amount: String(amount),
        dueDate,
        referenceMonth: refDate,
        source: 'PAYROLL',
        sourceId: e.id,
      });
      gerados++;
    }
  });

  revalidatePath('/minha-contabilidade/departamento-pessoal');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');

  return {
    ok: gerados > 0,
    message: gerados > 0
      ? `Folha de ${referenceMonth} gerada para ${gerados} colaborador(es).`
      : 'Folha desse mês já tinha sido gerada pra todo mundo elegível.',
  };
}
