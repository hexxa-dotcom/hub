'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { getDb, withTenant, eq, and, desc, withDbTimeout } from '@hexxa/db';
import { company, businessContract, financialEntry } from '@hexxa/db/schema';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';
import { gerarLancamentosDoContrato } from '@/lib/server/contract-financials';
import { makeContractSignatureService } from '@/lib/server/container';

export type ContractRow = {
  id: string;
  type: 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO';
  title: string;
  partyName: string;
  partyCnpj: string | null;
  value: number;
  dueDay: number;
  startDate: string;
  endDate: string;
  signingDate: string | null;
  status: 'AGUARDANDO_ASSINATURA' | 'ATIVO' | 'CANCELADO' | 'RECUSADO' | 'EXPIRADO';
  refusalReason: string | null;
  hasPdf: boolean;
  autoEmitNfse: boolean;
  lastNfseEmitted: boolean;
  nfseNumber: string | null;
  linkedOnPlatform: boolean;
  createdAt: string;
};

export type ContractPaymentRow = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  referenceMonth: string;
  status: string;
  paidAt: string | null;
  hasReceipt: boolean;
};

export type ContractDetail = {
  contract: ContractRow;
  mirrorPartyName: string | null;
  payments: ContractPaymentRow[];
};

function toRow(r: typeof businessContract.$inferSelect): ContractRow {
  return {
    id: r.id,
    type: r.type as 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO',
    title: r.title,
    partyName: r.partyName,
    partyCnpj: r.partyCnpj,
    value: Number(r.value),
    dueDay: r.dueDay,
    startDate: r.startDate,
    endDate: r.endDate,
    signingDate: r.signingDate,
    status: r.status as ContractRow['status'],
    refusalReason: r.refusalReason,
    hasPdf: !!r.pdfBase64,
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

export type CreateContractState = { ok: boolean; message: string; linked?: boolean };

export async function createContractAction(input: {
  type: 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO';
  title: string;
  partyName: string;
  partyCnpj?: string;
  value: number;
  dueDay: number;
  startDate: string;
  endDate: string;
  signingDate?: string;
  autoEmitNfse: boolean;
}): Promise<CreateContractState> {
  const ctx = await getTenantContext();
  const cnpjDigits = input.partyCnpj ? normalizeDocument(input.partyCnpj) : '';

  // A contraparte também é uma empresa cadastrada na Hexxa? (busca global por CNPJ)
  let counterparty: { id: string; legalName: string; cnpj: string } | null = null;
  if (cnpjDigits.length === 14) {
    const db = getDb();
    const rows = await withDbTimeout(
      db.select({ id: company.id, legalName: company.legalName, cnpj: company.cnpj }).from(company).where(eq(company.cnpj, formatDocument(cnpjDigits))),
      8000,
    );
    const found = rows[0];
    if (found && found.id !== ctx.companyId) counterparty = found;
  }

  const [own] = await withDbTimeout(
    getDb().select({ legalName: company.legalName, cnpj: company.cnpj }).from(company).where(eq(company.id, ctx.companyId)),
    8000,
  );

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
        signingDate: input.signingDate || null,
        autoEmitNfse: input.autoEmitNfse,
      })
      .returning();
  });

  if (!selfRow) return { ok: false, message: 'Erro ao salvar contrato.' };

  await gerarLancamentosDoContrato({
    companyId: ctx.companyId,
    contractId: selfRow.id,
    tipo: (input.type === 'ENTRADA' || input.type === 'MUTUO_ATIVO') ? 'RECEBER' : 'PAGAR',
    descricao: `[Contrato] ${input.title} — ${input.partyName}`,
    valor: input.value,
    dueDay: input.dueDay,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  let linked = false;

  if (counterparty && own) {
    const mirrorType = input.type === 'ENTRADA' ? 'SAIDA' : input.type === 'SAIDA' ? 'ENTRADA' : input.type === 'MUTUO_ATIVO' ? 'MUTUO_PASSIVO' : 'MUTUO_ATIVO';
    const [mirrorRow] = await withTenant(counterparty.id, async (tx) => {
      return tx
        .insert(businessContract)
        .values({
          companyId: counterparty!.id,
          type: mirrorType,
          title: input.title,
          partyName: own.legalName,
          partyCnpj: normalizeDocument(own.cnpj),
          counterpartyCompanyId: ctx.companyId,
          mirrorContractId: selfRow.id,
          value: String(input.value),
          dueDay: input.dueDay,
          startDate: input.startDate,
          endDate: input.endDate,
          signingDate: input.signingDate || null,
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
        tipo: (mirrorType === 'ENTRADA' || mirrorType === 'MUTUO_ATIVO') ? 'RECEBER' : 'PAGAR',
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

export async function getContractDetailAction(contractId: string): Promise<ContractDetail | null> {
  const ctx = await getTenantContext();
  const { self, mirror } = await getOwnAndMirror(contractId, ctx);
  if (!self) return null;

  let mirrorPartyName: string | null = null;
  if (mirror) {
    const [counterparty] = await withDbTimeout(
      getDb().select({ legalName: company.legalName }).from(company).where(eq(company.id, mirror.companyId)),
      8000,
    );
    mirrorPartyName = counterparty?.legalName ?? null;
  }

  const paymentRows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select()
      .from(financialEntry)
      .where(and(eq(financialEntry.source, 'CONTRACT'), eq(financialEntry.sourceId, self.id)))
      .orderBy(desc(financialEntry.dueDate));
  });

  return {
    contract: toRow(self),
    mirrorPartyName,
    payments: paymentRows.map((p) => ({
      id: p.id,
      description: p.description,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      referenceMonth: p.referenceMonth,
      status: p.status,
      paidAt: p.paidAt,
      hasReceipt: !!p.receiptBase64,
    })),
  };
}

export async function atualizarAssinaturaAction(contractId: string, signingDate: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const { self, mirror } = await getOwnAndMirror(contractId, ctx);
  if (!self) return { ok: false, message: 'Contrato não encontrado.' };

  await withTenant(ctx.companyId, async (tx) => {
    await tx
      .update(businessContract)
      .set({ signingDate: signingDate || null, updatedAt: new Date() })
      .where(eq(businessContract.id, self.id));
  });

  if (mirror) {
    await withTenant(mirror.companyId, async (tx) => {
      await tx
        .update(businessContract)
        .set({ signingDate: signingDate || null, updatedAt: new Date() })
        .where(eq(businessContract.id, mirror.id));
    });
  }

  revalidatePath(`/meu-negocio/contratos/${contractId}`);
  return { ok: true, message: 'Data de assinatura atualizada.' };
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
    tipo: (self.type === 'ENTRADA' || self.type === 'MUTUO_ATIVO') ? 'RECEBER' : 'PAGAR',
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
      tipo: (mirror.type === 'ENTRADA' || mirror.type === 'MUTUO_ATIVO') ? 'RECEBER' : 'PAGAR',
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

  if (self.signatureRequestId && self.status === 'AGUARDANDO_ASSINATURA') {
    try {
      await makeContractSignatureService().cancel(ctx, self.signatureRequestId);
    } catch (err) {
      console.error('Erro ao cancelar pedido de assinatura do contrato:', err);
    }
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

/** PDF do contrato gerado pelo wizard (base64) — buscado sob demanda pra não engordar o payload das listagens. */
export async function getContractPdfAction(contractId: string): Promise<string | null> {
  const ctx = await getTenantContext();
  const [row] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ pdfBase64: businessContract.pdfBase64 })
      .from(businessContract)
      .where(and(eq(businessContract.id, contractId), eq(businessContract.companyId, ctx.companyId)));
  });
  return row?.pdfBase64 ?? null;
}
