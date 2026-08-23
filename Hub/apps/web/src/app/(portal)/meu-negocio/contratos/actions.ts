'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { getDb, withTenant, eq, and, desc } from '@hexxa/db';
import { company, businessContract, financialEntry } from '@hexxa/db/schema';

export type ContractRow = {
  id: string;
  type: 'ENTRADA' | 'SAIDA';
  title: string;
  partyName: string;
  partyCnpj: string | null;
  value: number;
  dueDay: number;
  startDate: string;
  endDate: string;
  status: 'ATIVO' | 'CANCELADO';
  autoEmitNfse: boolean;
  lastNfseEmitted: boolean;
  nfseNumber: string | null;
  linkedOnPlatform: boolean;
  createdAt: string;
};

function onlyDigits(v: string) {
  return v.replace(/\D/g, '');
}

function toRow(r: typeof businessContract.$inferSelect): ContractRow {
  return {
    id: r.id,
    type: r.type as 'ENTRADA' | 'SAIDA',
    title: r.title,
    partyName: r.partyName,
    partyCnpj: r.partyCnpj,
    value: Number(r.value),
    dueDay: r.dueDay,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status as 'ATIVO' | 'CANCELADO',
    autoEmitNfse: r.autoEmitNfse,
    lastNfseEmitted: r.lastNfseEmitted,
    nfseNumber: r.nfseNumber,
    linkedOnPlatform: !!r.counterpartyCompanyId,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listContractsAction(): Promise<ContractRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(businessContract)
      .where(eq(businessContract.companyId, ctx.companyId))
      .orderBy(desc(businessContract.createdAt));
  });
  return rows.map(toRow);
}

/** Gera os lançamentos financeiros mensais de um contrato para UMA empresa. */
async function gerarLancamentosDoContrato(params: {
  companyId: string;
  contractId: string;
  tipo: 'PAGAR' | 'RECEBER';
  descricao: string;
  valor: number;
  dueDay: number;
  startDate: string;
  endDate: string;
}) {
  const { companyId, contractId, tipo, descricao, valor, dueDay, startDate, endDate } = params;
  const typeStr = tipo === 'PAGAR' ? 'PAYABLE' : 'RECEIVABLE';

  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const months = Math.max(
    1,
    Math.min(60, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1),
  );

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      due.setDate(Math.min(dueDay, 28));
      const dueDateStr = due.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';

      await tx.insert(financialEntry).values({
        companyId,
        type: typeStr,
        description: months > 1 ? `${descricao} (${i + 1}/${months})` : descricao,
        amount: String(valor),
        dueDate: dueDateStr,
        referenceMonth: refMonth,
        status: 'PENDING',
        source: 'CONTRACT',
        sourceId: contractId,
      });
    }
  });
}

export type CreateContractState = { ok: boolean; message: string; linked?: boolean };

export async function createContractAction(input: {
  type: 'ENTRADA' | 'SAIDA';
  title: string;
  partyName: string;
  partyCnpj?: string;
  value: number;
  dueDay: number;
  startDate: string;
  endDate: string;
  autoEmitNfse: boolean;
}): Promise<CreateContractState> {
  const ctx = await getTenantContext();
  const cnpjDigits = input.partyCnpj ? onlyDigits(input.partyCnpj) : '';

  // A contraparte também é uma empresa cadastrada na Hexxa? (busca global por CNPJ)
  let counterparty: { id: string; legalName: string; cnpj: string } | null = null;
  if (cnpjDigits.length === 14) {
    const db = getDb();
    const rows = await db
      .select({ id: company.id, legalName: company.legalName, cnpj: company.cnpj })
      .from(company)
      .where(eq(company.cnpj, formatCnpj(cnpjDigits)));
    const found = rows[0];
    if (found && found.id !== ctx.companyId) counterparty = found;
  }

  const [own] = await getDb()
    .select({ legalName: company.legalName, cnpj: company.cnpj })
    .from(company)
    .where(eq(company.id, ctx.companyId));

  const [selfRow] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .insert(businessContract)
      .values({
        companyId: ctx.companyId,
        type: input.type,
        title: input.title,
        partyName: input.partyName,
        partyCnpj: cnpjDigits || null,
        counterpartyCompanyId: counterparty?.id ?? null,
        value: String(input.value),
        dueDay: input.dueDay,
        startDate: input.startDate,
        endDate: input.endDate,
        autoEmitNfse: input.autoEmitNfse,
      })
      .returning();
  });

  if (!selfRow) return { ok: false, message: 'Erro ao salvar contrato.' };

  await gerarLancamentosDoContrato({
    companyId: ctx.companyId,
    contractId: selfRow.id,
    tipo: input.type === 'ENTRADA' ? 'RECEBER' : 'PAGAR',
    descricao: `[Contrato] ${input.title} — ${input.partyName}`,
    valor: input.value,
    dueDay: input.dueDay,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  let linked = false;

  if (counterparty && own) {
    const mirrorType = input.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
    const [mirrorRow] = await withTenant(counterparty.id, async (tx) => {
      return tx
        .insert(businessContract)
        .values({
          companyId: counterparty!.id,
          type: mirrorType,
          title: input.title,
          partyName: own.legalName,
          partyCnpj: onlyDigits(own.cnpj),
          counterpartyCompanyId: ctx.companyId,
          mirrorContractId: selfRow.id,
          value: String(input.value),
          dueDay: input.dueDay,
          startDate: input.startDate,
          endDate: input.endDate,
        })
        .returning();
    });

    if (mirrorRow) {
      await withTenant(ctx.companyId, async (tx) => {
        await tx
          .update(businessContract)
          .set({ mirrorContractId: mirrorRow.id })
          .where(eq(businessContract.id, selfRow.id));
      });

      await gerarLancamentosDoContrato({
        companyId: counterparty.id,
        contractId: mirrorRow.id,
        tipo: mirrorType === 'ENTRADA' ? 'RECEBER' : 'PAGAR',
        descricao: `[Contrato] ${input.title} — ${own.legalName}`,
        valor: input.value,
        dueDay: input.dueDay,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      linked = true;
    }
  }

  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');

  return {
    ok: true,
    linked,
    message: linked
      ? `Contrato salvo e sincronizado automaticamente com ${counterparty!.legalName} (também cliente Hexxa) — os lançamentos financeiros de ambos os lados já foram gerados.`
      : 'Contrato salvo e lançamentos financeiros gerados.',
  };
}

function formatCnpj(digits: string) {
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

async function getOwnAndMirror(contractId: string, ctx: { companyId: string }) {
  const [self] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(businessContract)
      .where(and(eq(businessContract.id, contractId), eq(businessContract.companyId, ctx.companyId)));
  });
  if (!self) return { self: null, mirror: null };

  if (!self.mirrorContractId || !self.counterpartyCompanyId) return { self, mirror: null };

  const [mirror] = await withTenant(self.counterpartyCompanyId, async (tx) => {
    return tx.select().from(businessContract).where(eq(businessContract.id, self.mirrorContractId!));
  });

  return { self, mirror: mirror ?? null };
}

export async function reajustarContratoAction(contractId: string, percentual: number): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const { self, mirror } = await getOwnAndMirror(contractId, ctx);
  if (!self) return { ok: false, message: 'Contrato não encontrado.' };

  const novoValor = Number(self.value) * (1 + percentual / 100);

  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(businessContract)
      .set({ value: String(novoValor), updatedAt: new Date() })
      .where(eq(businessContract.id, self.id));
  });

  if (mirror) {
    await withTenant(mirror.companyId, async (tx) => {
      await tx
        .update(businessContract)
        .set({ value: String(novoValor), updatedAt: new Date() })
        .where(eq(businessContract.id, mirror.id));
    });
  }

  revalidatePath('/meu-negocio/contratos');
  return { ok: true, message: mirror ? 'Reajuste aplicado nos dois lados do contrato.' : 'Reajuste aplicado.' };
}

export async function renovarContratoAction(contractId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const { self, mirror } = await getOwnAndMirror(contractId, ctx);
  if (!self) return { ok: false, message: 'Contrato não encontrado.' };

  const oldEnd = new Date(self.endDate + 'T12:00:00');
  const newStart = new Date(oldEnd);
  newStart.setDate(newStart.getDate() + 1);
  const newEnd = new Date(oldEnd);
  newEnd.setFullYear(newEnd.getFullYear() + 1);
  const newEndStr = newEnd.toISOString().split('T')[0]!;
  const newStartStr = newStart.toISOString().split('T')[0]!;

  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(businessContract)
      .set({ endDate: newEndStr, status: 'ATIVO', updatedAt: new Date() })
      .where(eq(businessContract.id, self.id));
  });

  await gerarLancamentosDoContrato({
    companyId: self.companyId,
    contractId: self.id,
    tipo: self.type === 'ENTRADA' ? 'RECEBER' : 'PAGAR',
    descricao: `[Contrato renovado] ${self.title} — ${self.partyName}`,
    valor: Number(self.value),
    dueDay: self.dueDay,
    startDate: newStartStr,
    endDate: newEndStr,
  });

  if (mirror) {
    await withTenant(mirror.companyId, async (tx) => {
      await tx
        .update(businessContract)
        .set({ endDate: newEndStr, status: 'ATIVO', updatedAt: new Date() })
        .where(eq(businessContract.id, mirror.id));
    });

    await gerarLancamentosDoContrato({
      companyId: mirror.companyId,
      contractId: mirror.id,
      tipo: mirror.type === 'ENTRADA' ? 'RECEBER' : 'PAGAR',
      descricao: `[Contrato renovado] ${mirror.title} — ${mirror.partyName}`,
      valor: Number(mirror.value),
      dueDay: mirror.dueDay,
      startDate: newStartStr,
      endDate: newEndStr,
    });
  }

  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');
  return { ok: true, message: mirror ? 'Contrato renovado nos dois lados, com novos lançamentos gerados.' : 'Contrato renovado.' };
}

export async function cancelarContratoAction(contractId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const { self, mirror } = await getOwnAndMirror(contractId, ctx);
  if (!self) return { ok: false, message: 'Contrato não encontrado.' };

  const today = new Date().toISOString().split('T')[0]!;

  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(businessContract)
      .set({ status: 'CANCELADO', updatedAt: new Date() })
      .where(eq(businessContract.id, self.id));
    await tx
      .update(financialEntry)
      .set({ status: 'CANCELED' })
      .where(
        and(
          eq(financialEntry.source, 'CONTRACT'),
          eq(financialEntry.sourceId, self.id),
          eq(financialEntry.status, 'PENDING'),
        ),
      );
  });

  if (mirror) {
    await withTenant(mirror.companyId, async (tx) => {
      await tx
        .update(businessContract)
        .set({ status: 'CANCELADO', updatedAt: new Date() })
        .where(eq(businessContract.id, mirror.id));
      await tx
        .update(financialEntry)
        .set({ status: 'CANCELED' })
        .where(
          and(
            eq(financialEntry.source, 'CONTRACT'),
            eq(financialEntry.sourceId, mirror.id),
            eq(financialEntry.status, 'PENDING'),
          ),
        );
    });
  }

  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');
  return {
    ok: true,
    message: mirror
      ? 'Contrato cancelado nos dois lados. Lançamentos futuros ainda pendentes foram cancelados.'
      : `Contrato cancelado a partir de ${today}. Lançamentos futuros ainda pendentes foram cancelados.`,
  };
}

/** Registra manualmente o número de uma nota já emitida fora deste fluxo (em /meu-negocio/notas). */
export async function marcarNfseEmitidaAction(contractId: string, nfseNumber: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const numero = nfseNumber.trim();
  if (!numero) return { ok: false, message: 'Informe o número da nota.' };

  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(businessContract)
      .set({ lastNfseEmitted: true, nfseNumber: numero, updatedAt: new Date() })
      .where(and(eq(businessContract.id, contractId), eq(businessContract.companyId, ctx.companyId)));
  });

  revalidatePath('/meu-negocio/contratos');
  return { ok: true, message: 'Contrato marcado como faturado.' };
}
