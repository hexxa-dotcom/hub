'use server';

import { revalidatePath } from 'next/cache';
import { renderToBuffer } from '@react-pdf/renderer';
import { getTenantContext } from '@/lib/server/tenant';
import type { TenantContext } from '@hexxa/core';
import { getDb, withTenant, withDbTimeout, eq, and } from '@hexxa/db';
import { company, membership, appUser, businessContract, lease, property } from '@hexxa/db/schema';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';
import { makeContractSignatureService, signatureRequestRepository } from '@/lib/server/container';
import { gerarLancamentosDoContrato, gerarLancamentosDoAluguel } from '@/lib/server/contract-financials';
import { StandardContractTemplate, type ContractData } from './StandardContractTemplate';
import { MutuoContractTemplate, type MutuoContractData } from './MutuoContractTemplate';
import { AluguelContractTemplate, type AluguelContractData } from './AluguelContractTemplate';
import type { WizardSubmission } from './wizard-types';

const MIRROR_TYPE: Record<'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO', 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO'> = {
  ENTRADA: 'SAIDA',
  SAIDA: 'ENTRADA',
  MUTUO_ATIVO: 'MUTUO_PASSIVO',
  MUTUO_PASSIVO: 'MUTUO_ATIVO',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOwnCompany(companyId: string) {
  const [row] = await withDbTimeout(
    getDb().select().from(company).where(eq(company.id, companyId)),
    8000,
  );
  return row ?? null;
}

function formatCompanyAddress(c: {
  addressLine1: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}): string {
  const parts = [
    c.addressLine1 ? `${c.addressLine1}, ${c.addressNumber || 's/n'}` : null,
    c.neighborhood,
    c.city && c.state ? `${c.city}/${c.state}` : (c.city ?? c.state ?? null),
  ].filter(Boolean);
  return parts.join(' — ') || 'Endereço não informado';
}

/** Acha o dono (OWNER) de uma empresa cadastrada na Hexxa, pra auto-preencher signatário. */
async function findCompanyOwnerContact(companyId: string): Promise<{ name: string; email: string } | null> {
  const [member] = await withDbTimeout(
    getDb().select({ userId: membership.userId }).from(membership).where(and(eq(membership.companyId, companyId), eq(membership.role, 'OWNER'))).limit(1),
    8000,
  );
  if (!member) return null;
  const [user] = await withDbTimeout(
    getDb().select({ name: appUser.name, email: appUser.email }).from(appUser).where(eq(appUser.id, member.userId)).limit(1),
    8000,
  );
  return user ?? null;
}

export type CounterpartyLookup =
  | { found: false }
  | { found: true; legalName: string; ownerName: string; ownerEmail: string };

/** Detecta se um CNPJ pertence a outra empresa já cadastrada na Hexxa — usado pelo wizard pra auto-preencher nome/e-mail do signatário. */
export async function lookupCounterpartyAction(cnpj: string): Promise<CounterpartyLookup> {
  const ctx = await getTenantContext();
  const digits = normalizeDocument(cnpj);
  if (digits.length !== 14) return { found: false };

  const [found] = await withDbTimeout(
    getDb().select({ id: company.id, legalName: company.legalName }).from(company).where(eq(company.cnpj, formatDocument(digits))),
    8000,
  );
  if (!found || found.id === ctx.companyId) return { found: false };

  const owner = await findCompanyOwnerContact(found.id);
  if (!owner) return { found: false };

  return { found: true, legalName: found.legalName, ownerName: owner.name, ownerEmail: owner.email };
}

export type PropertyOption = { id: string; label: string };

/** Imóveis disponíveis (sem locação ativa) da empresa, pra alimentar o passo "Aluguel" do wizard. */
export async function listPropertiesForWizardAction(): Promise<PropertyOption[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ id: property.id, label: property.label })
      .from(property)
      .where(and(eq(property.companyId, ctx.companyId), eq(property.status, 'AVAILABLE')));
  });
  return rows;
}

export type CreateWizardContractState = { ok: boolean; message: string };

/**
 * Fluxo único do wizard: gera o documento padrão (ou usa o PDF já assinado
 * enviado pelo usuário), cria o registro (business_contract ou lease) e só
 * lança financeiro na hora se o documento já veio assinado — do contrário
 * nasce AGUARDANDO_ASSINATURA/PENDING_SIGNATURE e o financeiro só nasce
 * quando o webhook do DocuSeal confirmar SIGNED (ver api/webhooks/docuseal).
 */
export async function criarContratoEAssinarAction(input: WizardSubmission): Promise<CreateWizardContractState> {
  const ctx = await getTenantContext();
  const own = await getOwnCompany(ctx.companyId);
  if (!own) return { ok: false, message: 'Empresa não encontrada.' };
  const ownParty = { name: own.legalName, document: formatDocument(normalizeDocument(own.cnpj)), address: formatCompanyAddress(own) };

  const { formData, documentSource, cityDate } = input;

  if (documentSource === 'ALREADY_SIGNED' && !input.signedPdfBase64) {
    return { ok: false, message: 'Anexe o PDF do contrato já assinado.' };
  }
  if (documentSource === 'ALREADY_SIGNED' && !input.signingDate) {
    return { ok: false, message: 'Informe a data em que o contrato foi assinado.' };
  }

  try {
    if (formData.kind === 'ALUGUEL') {
      return await criarAluguel(ctx, ownParty, formData, input);
    }
    return await criarContratoFinanceiro(ctx, ownParty, formData, input);
  } catch (err) {
    console.error('Erro ao criar contrato pelo wizard unificado:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Erro ao criar contrato.' };
  }
}

// ── SERVIÇO e MÚTUO (business_contract) ─────────────────────────────────────

async function criarContratoFinanceiro(
  ctx: TenantContext,
  ownParty: { name: string; document: string; address: string },
  formData: Extract<WizardSubmission['formData'], { kind: 'SERVICO' | 'MUTUO' }>,
  input: WizardSubmission,
): Promise<CreateWizardContractState> {
  const companyId = ctx.companyId;
  const { contraparte } = formData;
  if (!contraparte.name.trim()) return { ok: false, message: 'Informe o nome da contraparte.' };
  const valor = formData.kind === 'SERVICO' ? formData.valor : formData.valor;
  if (!valor || valor <= 0) return { ok: false, message: 'Informe um valor válido.' };

  const cnpjDigits = normalizeDocument(contraparte.document);
  let counterparty: { id: string; legalName: string; cnpj: string } | null = null;
  if (cnpjDigits.length === 14) {
    const [found] = await withDbTimeout(
      getDb().select({ id: company.id, legalName: company.legalName, cnpj: company.cnpj }).from(company).where(eq(company.cnpj, formatDocument(cnpjDigits))),
      8000,
    );
    if (found && found.id !== companyId) counterparty = found;
  }

  // Tipo de contrato no domínio ENTRADA/SAIDA/MUTUO_ATIVO/MUTUO_PASSIVO.
  const type: 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO' =
    formData.kind === 'SERVICO'
      ? 'ENTRADA' // wizard de Serviço = sempre a própria empresa prestando serviço (receita)
      : formData.direcao;
  const title = formData.kind === 'SERVICO' ? formData.descricao.slice(0, 120) || 'Prestação de Serviço' : `Mútuo — ${contraparte.name}`;
  const { startDate, endDate, dueDay } = formData;

  const status = input.documentSource === 'ALREADY_SIGNED' ? 'ATIVO' : 'AGUARDANDO_ASSINATURA';
  const signingDate = input.documentSource === 'ALREADY_SIGNED' ? (input.signingDate ?? null) : null;

  let pdfBase64: string;
  let pdfFilename: string;
  if (input.documentSource === 'ALREADY_SIGNED') {
    pdfBase64 = input.signedPdfBase64!;
    pdfFilename = input.signedPdfFilename || 'contrato-assinado.pdf';
  } else {
    const doc =
      formData.kind === 'SERVICO'
        ? gerarPdfServico(ownParty, formData, input.cityDate)
        : gerarPdfMutuo(ownParty, formData, input.cityDate);
    const buffer = await renderToBuffer(doc as any);
    pdfBase64 = buffer.toString('base64');
    pdfFilename = `${formData.kind === 'SERVICO' ? 'Contrato' : 'Mutuo'}_${contraparte.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  }

  const [selfRow] = await withTenant(companyId, async (tx) => {
    return tx
      .insert(businessContract)
      .values({
        companyId,
        type,
        title,
        partyName: contraparte.name,
        partyCnpj: cnpjDigits || null,
        counterpartyCompanyId: counterparty?.id ?? null,
        value: String(valor),
        dueDay,
        startDate,
        endDate,
        signingDate,
        status,
        pdfBase64,
      })
      .returning();
  });
  if (!selfRow) return { ok: false, message: 'Erro ao salvar contrato.' };

  let mirrorRow: typeof businessContract.$inferSelect | undefined;
  if (counterparty) {
    const mirrorType = MIRROR_TYPE[type];
    [mirrorRow] = await withTenant(counterparty.id, async (tx) => {
      return tx
        .insert(businessContract)
        .values({
          companyId: counterparty!.id,
          type: mirrorType,
          title,
          partyName: ownParty.name,
          partyCnpj: normalizeDocument(ownParty.document),
          counterpartyCompanyId: companyId,
          mirrorContractId: selfRow.id,
          value: String(valor),
          dueDay,
          startDate,
          endDate,
          signingDate,
          status,
          pdfBase64,
        })
        .returning();
    });
    if (mirrorRow) {
      await withTenant(companyId, async (tx) => {
        await tx.update(businessContract).set({ mirrorContractId: mirrorRow!.id }).where(eq(businessContract.id, selfRow.id));
      });
    }
  }

  if (input.documentSource === 'ALREADY_SIGNED') {
    await gerarLancamentosDoContrato({
      companyId,
      contractId: selfRow.id,
      tipo: type === 'ENTRADA' || type === 'MUTUO_ATIVO' ? 'RECEBER' : 'PAGAR',
      descricao: `[Contrato] ${title} — ${contraparte.name}`,
      valor,
      dueDay,
      startDate,
      endDate,
    });
    if (mirrorRow) {
      const mirrorType = mirrorRow.type as 'ENTRADA' | 'SAIDA' | 'MUTUO_ATIVO' | 'MUTUO_PASSIVO';
      await gerarLancamentosDoContrato({
        companyId: mirrorRow.companyId,
        contractId: mirrorRow.id,
        tipo: mirrorType === 'ENTRADA' || mirrorType === 'MUTUO_ATIVO' ? 'RECEBER' : 'PAGAR',
        descricao: `[Contrato] ${title} — ${ownParty.name}`,
        valor,
        dueDay,
        startDate,
        endDate,
      });
    }
  } else {
    // AUTO: manda pra assinatura. Se há espelho, os dois lados assinam o
    // MESMO envelope (dois signatários) — os dois só ativam quando o
    // DocuSeal confirmar SIGNED (ver activateLinkedRecords no webhook).
    const signers: { name: string; email: string; role?: string }[] = [];
    if (contraparte.email.trim()) {
      signers.push({ name: contraparte.name, email: contraparte.email.trim(), role: 'Contraparte' });
    }
    if (mirrorRow) {
      const ownOwner = await findCompanyOwnerContact(companyId);
      if (ownOwner) signers.push({ name: ownOwner.name, email: ownOwner.email, role: ownParty.name });
    }
    if (!signers.length) {
      return { ok: false, message: 'Informe o e-mail da contraparte para enviar para assinatura.' };
    }

    const service = makeContractSignatureService();
    const result = await service.send(ctx, {
      title,
      documentBuffer: { base64: pdfBase64, filename: pdfFilename },
      signers,
      subject: { type: 'CONTRACT', id: selfRow.id },
    });

    await withTenant(companyId, async (tx) => {
      await tx.update(businessContract).set({ signatureRequestId: result.id }).where(eq(businessContract.id, selfRow.id));
    });
    if (mirrorRow) {
      await withTenant(mirrorRow.companyId, async (tx) => {
        await tx.update(businessContract).set({ signatureRequestId: result.id }).where(eq(businessContract.id, mirrorRow!.id));
      });
    }
  }

  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');
  revalidatePath('/cliente');

  return {
    ok: true,
    message:
      input.documentSource === 'ALREADY_SIGNED'
        ? 'Contrato registrado como ativo e lançamentos financeiros gerados.'
        : mirrorRow
          ? 'Contrato enviado para assinatura — como a contraparte também é cliente Hexxa, os dois lados assinam o mesmo envelope e ativam juntos.'
          : 'Contrato enviado para assinatura eletrônica.',
  };
}

function gerarPdfServico(own: { name: string; document: string; address: string }, formData: Extract<WizardSubmission['formData'], { kind: 'SERVICO' }>, cityDate: string) {
  const data: ContractData = {
    contractor: { name: formData.contraparte.name, document: formData.contraparte.document, address: formData.contraparte.address },
    contractee: own,
    service: {
      description: formData.descricao,
      value: formData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      paymentTerms: formData.formaPagamento,
      deadline: `${formData.startDate} a ${formData.endDate}`,
    },
    cityDate,
  };
  return <StandardContractTemplate data={data} />;
}

function gerarPdfMutuo(own: { name: string; document: string; address: string }, formData: Extract<WizardSubmission['formData'], { kind: 'MUTUO' }>, cityDate: string) {
  const contraparteParty = { name: formData.contraparte.name, document: formData.contraparte.document, address: formData.contraparte.address };
  const data: MutuoContractData = {
    mutuante: formData.direcao === 'MUTUO_ATIVO' ? own : contraparteParty,
    mutuario: formData.direcao === 'MUTUO_ATIVO' ? contraparteParty : own,
    loan: {
      value: formData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      interestRate: formData.jurosAoMes,
      paymentTerms: formData.formaPagamento,
      deadline: formData.prazo,
    },
    cityDate,
  };
  return <MutuoContractTemplate data={data} />;
}

// ── ALUGUEL (lease, módulo Patrimonial) ─────────────────────────────────────

async function criarAluguel(
  ctx: TenantContext,
  ownParty: { name: string; document: string; address: string },
  formData: Extract<WizardSubmission['formData'], { kind: 'ALUGUEL' }>,
  input: WizardSubmission,
): Promise<CreateWizardContractState> {
  const companyId = ctx.companyId;
  if (!formData.propertyId) return { ok: false, message: 'Selecione o imóvel.' };
  if (!formData.contraparte.name.trim()) return { ok: false, message: 'Informe o nome do locatário.' };
  if (!formData.monthlyRent || formData.monthlyRent <= 0) return { ok: false, message: 'Informe um valor de aluguel válido.' };

  const status = input.documentSource === 'ALREADY_SIGNED' ? 'ACTIVE' : 'PENDING_SIGNATURE';

  let pdfBase64: string;
  let pdfFilename: string;
  if (input.documentSource === 'ALREADY_SIGNED') {
    pdfBase64 = input.signedPdfBase64!;
    pdfFilename = input.signedPdfFilename || 'contrato-aluguel-assinado.pdf';
  } else {
    const [propertyRow] = await withTenant(companyId, async (tx) => {
      return tx.select({ address: property.address }).from(property).where(eq(property.id, formData.propertyId));
    });
    const data: AluguelContractData = {
      locador: ownParty,
      locatario: { name: formData.contraparte.name, document: formData.contraparte.document, address: formData.contraparte.address },
      imovel: { label: formData.propertyLabel, endereco: propertyRow?.address || 'Endereço não informado' },
      aluguel: {
        valor: formData.monthlyRent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        indice: formData.indexType,
        vencimento: '10',
      },
      vigencia: { inicio: formData.startDate, fim: formData.endDate },
      cityDate: input.cityDate,
    };
    const buffer = await renderToBuffer(<AluguelContractTemplate data={data} /> as any);
    pdfBase64 = buffer.toString('base64');
    pdfFilename = `Aluguel_${formData.contraparte.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  }

  const [leaseRow] = await withTenant(companyId, async (tx) => {
    return tx
      .insert(lease)
      .values({
        companyId,
        propertyId: formData.propertyId,
        lesseeName: formData.contraparte.name,
        monthlyRent: String(formData.monthlyRent),
        indexType: formData.indexType,
        adjustmentAnchor: formData.startDate,
        status,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        pdfBase64,
      })
      .returning();
  });
  if (!leaseRow) return { ok: false, message: 'Erro ao salvar contrato de aluguel.' };

  // Reserva o imóvel assim que o contrato nasce (mesmo ainda pendente de
  // assinatura) — do contrário ele continuaria aparecendo como disponível
  // pro wizard e alguém poderia criar um segundo contrato pro mesmo imóvel
  // enquanto este aguarda ser assinado. Revertido pro webhook se recusado/expirado.
  await withTenant(companyId, async (tx) => {
    await tx.update(property).set({ status: 'RENTED' }).where(eq(property.id, formData.propertyId));
  });

  if (input.documentSource === 'ALREADY_SIGNED') {
    await gerarLancamentosDoAluguel({
      companyId,
      leaseId: leaseRow.id,
      descricao: `[Aluguel] ${formData.contraparte.name}`,
      valor: formData.monthlyRent,
      startDate: formData.startDate,
      endDate: formData.endDate || null,
    });
  } else {
    if (!formData.contraparte.email.trim()) {
      return { ok: false, message: 'Informe o e-mail do locatário para enviar para assinatura.' };
    }
    const service = makeContractSignatureService();
    const result = await service.send(ctx, {
      title: `Contrato de Locação — ${formData.propertyLabel}`,
      documentBuffer: { base64: pdfBase64, filename: pdfFilename },
      signers: [{ name: formData.contraparte.name, email: formData.contraparte.email.trim(), role: 'Locatário(a)' }],
      subject: { type: 'LEASE', id: leaseRow.id },
    });
    await withTenant(companyId, async (tx) => {
      await tx.update(lease).set({ signatureRequestId: result.id }).where(eq(lease.id, leaseRow.id));
    });
  }

  revalidatePath('/patrimonial');
  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/meu-negocio/hub-financeiro');

  return {
    ok: true,
    message:
      input.documentSource === 'ALREADY_SIGNED'
        ? 'Contrato de aluguel registrado como ativo e lançamentos gerados.'
        : 'Contrato de aluguel enviado para assinatura eletrônica.',
  };
}

// ── Reenvio (lembrete manual) ───────────────────────────────────────────────

export async function reenviarParaAssinaturaAction(contractId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();

  const [contract] = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(businessContract).where(and(eq(businessContract.id, contractId), eq(businessContract.companyId, ctx.companyId)));
  });
  const [leaseRow] = contract
    ? []
    : await withTenant(ctx.companyId, async (tx) => {
        return tx.select().from(lease).where(and(eq(lease.id, contractId), eq(lease.companyId, ctx.companyId)));
      });

  const record = contract ?? leaseRow;
  if (!record) return { ok: false, message: 'Contrato não encontrado.' };
  if (!record.pdfBase64 || !record.signatureRequestId) {
    return { ok: false, message: 'Este contrato não tem um envelope de assinatura para reenviar.' };
  }

  const old = await signatureRequestRepository.findById(ctx, record.signatureRequestId);
  if (!old || !old.signerEmail) {
    return { ok: false, message: 'Não foi possível recuperar os dados do signatário original.' };
  }

  const service = makeContractSignatureService();
  const result = await service.send(ctx, {
    title: old.title || 'Contrato',
    documentBuffer: { base64: record.pdfBase64, filename: 'contrato.pdf' },
    signers: [{ name: old.signerName || old.signerEmail, email: old.signerEmail }],
    subject: { type: contract ? 'CONTRACT' : 'LEASE', id: record.id },
  });

  if (contract) {
    await withTenant(ctx.companyId, async (tx) => {
      await tx.update(businessContract).set({ signatureRequestId: result.id }).where(eq(businessContract.id, record.id));
    });
  } else {
    await withTenant(ctx.companyId, async (tx) => {
      await tx.update(lease).set({ signatureRequestId: result.id }).where(eq(lease.id, record.id));
    });
  }

  revalidatePath('/meu-negocio/contratos');
  revalidatePath('/patrimonial');
  return { ok: true, message: 'Reenviado para assinatura.' };
}
