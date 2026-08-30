'use server';

import { revalidatePath } from 'next/cache';
import { renderToBuffer } from '@react-pdf/renderer';
import { getTenantContext } from '@/lib/server/tenant';
import type { TenantContext } from '@hexxa/core';
import { getDb, withTenant, withDbTimeout, eq, and, ilike } from '@hexxa/db';
import { company, membership, appUser, businessContract, lease, property, customer } from '@hexxa/db/schema';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';
import { makeContractSignatureService, signatureRequestRepository } from '@/lib/server/container';
import { gerarLancamentosDoContrato, gerarLancamentosDoAluguel } from '@/lib/server/contract-financials';
import { draftContractField } from '@/lib/server/ai-draft';
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

export type CustomerOption = { id: string; name: string; document: string | null; email: string | null; address: string | null };

/** Busca clientes já cadastrados (Meu Negócio > Clientes) por nome, pro wizard oferecer "usar cliente existente" em vez de digitar tudo de novo. */
export async function searchCustomersAction(query: string): Promise<CustomerOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({ id: customer.id, name: customer.name, document: customer.document, email: customer.email, address: customer.address })
      .from(customer)
      .where(and(eq(customer.companyId, ctx.companyId), ilike(customer.name, `%${q}%`)))
      .limit(8);
  });
  return rows;
}

export type ContractFieldForSuggestion = 'descricao' | 'formaPagamento' | 'prazo';

/**
 * Sugestão de texto por IA pra um campo livre do wizard. Pro campo
 * `descricao`: se o cliente já escreveu algo (rascunho), a IA só REORGANIZA
 * e formaliza o que foi escrito — não inventa escopo novo. Se estiver
 * vazio, gera uma sugestão inicial a partir do contexto (categoria, valor,
 * contraparte).
 */
export async function sugerirTextoContratoAction(input: {
  field: ContractFieldForSuggestion;
  kind: 'SERVICO' | 'MUTUO';
  direcao: string;
  partyName: string;
  valor: number;
  categoria?: string;
  draft?: string;
}): Promise<{ ok: boolean; text: string; message?: string }> {
  const valorFmt = input.valor ? input.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '(valor não informado)';
  const categoriaTrecho = input.categoria ? ` Categoria do serviço: ${input.categoria}.` : '';
  const contratoContexto =
    input.kind === 'SERVICO'
      ? input.direcao === 'SAIDA'
        ? `Contrato de prestação de serviço onde a empresa CONTRATA ${input.partyName || '(prestador)'} como prestador, valor ${valorFmt}.${categoriaTrecho}`
        : `Contrato de prestação de serviço onde a empresa PRESTA o serviço a ${input.partyName || '(cliente)'}, valor ${valorFmt}.${categoriaTrecho}`
      : `Contrato de mútuo financeiro (empréstimo) entre a empresa e ${input.partyName || '(contraparte)'}, valor ${valorFmt}.`;

  const draft = input.draft?.trim();
  const descricaoPrompt = draft
    ? `${contratoContexto}\n\nO cliente escreveu o seguinte rascunho, em linguagem informal, descrevendo o serviço:\n"""\n${draft}\n"""\n\nReescreva ISSO em um texto formal, corrido e bem ordenado (1 a 3 frases, sem markdown, sem aspas), adequado pra entrar no corpo de um contrato brasileiro. Mantenha exatamente o mesmo escopo e conteúdo do rascunho — só organize a ordem das ideias e formalize a linguagem. NÃO adicione tarefas, valores ou prazos que não estejam no rascunho.`
    : `${contratoContexto}\n\nEscreva uma descrição curta e profissional (1 a 2 frases, direto, sem markdown, sem aspas) do objeto/escopo do serviço prestado, adequada pra entrar no corpo de um contrato formal brasileiro. Não invente nomes, valores ou prazos que não foram dados.`;

  const prompts: Record<ContractFieldForSuggestion, string> = {
    descricao: descricaoPrompt,
    formaPagamento: `${contratoContexto}\n\nSugira uma forma de pagamento curta e comum no Brasil pra esse tipo de contrato (ex.: meio de pagamento + periodicidade + dia do vencimento), em 1 frase, sem markdown, sem aspas.`,
    prazo: `${contratoContexto}\n\nSugira um prazo/vencimento final razoável pra esse mútuo, em 1 frase curta (ex.: "12 meses, prorrogável mediante acordo entre as partes"), sem markdown, sem aspas.`,
  };

  try {
    const text = await draftContractField(prompts[input.field]);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, text: '', message: err instanceof Error ? err.message : 'Erro ao gerar sugestão.' };
  }
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
    formData.kind === 'SERVICO' ? formData.direcao : formData.direcao;
  const title = formData.kind === 'SERVICO' ? formData.descricao.slice(0, 120) || 'Prestação de Serviço' : `Mútuo — ${contraparte.name}`;
  const { startDate, endDate, dueDay } = formData;

  const externalProviderId = formData.kind === 'SERVICO' && formData.direcao === 'SAIDA' ? formData.externalProviderId?.trim() || null : null;
  const repassePercent = formData.kind === 'SERVICO' && formData.direcao === 'SAIDA' ? formData.repassePercent ?? null : null;
  const paymentFrequency = formData.kind === 'SERVICO' ? formData.paymentFrequency ?? 'MENSAL' : 'MENSAL';
  if ((externalProviderId && repassePercent == null) || (!externalProviderId && repassePercent != null)) {
    return { ok: false, message: 'Pra vincular o repasse automático, informe o ID do prestador na integração E o percentual — os dois juntos.' };
  }
  if (repassePercent != null && (repassePercent <= 0 || repassePercent > 100)) {
    return { ok: false, message: 'O percentual de repasse deve ser entre 0 e 100.' };
  }
  if (externalProviderId) {
    const [existingActive] = await withTenant(companyId, async (tx) => {
      return tx
        .select({ id: businessContract.id })
        .from(businessContract)
        .where(
          and(
            eq(businessContract.companyId, companyId),
            eq(businessContract.externalProviderId, externalProviderId),
            eq(businessContract.status, 'ATIVO'),
          ),
        )
        .limit(1);
    });
    if (existingActive) {
      return { ok: false, message: 'Já existe um contrato ativo vinculado a este ID de prestador na integração. Encerre-o antes de criar um novo.' };
    }
  }

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
        externalProviderId,
        repassePercent: repassePercent != null ? String(repassePercent) : null,
        paymentFrequency,
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
  const contraparteParty = { name: formData.contraparte.name, document: formData.contraparte.document, address: formData.contraparte.address };
  // ENTRADA: minha empresa presta o serviço (CONTRATADA, recebe) — a contraparte é a CONTRATANTE (paga).
  // SAIDA: minha empresa contrata (CONTRATANTE, paga) — a contraparte é a CONTRATADA (presta o serviço, recebe).
  const data: ContractData = {
    contractor: formData.direcao === 'SAIDA' ? own : contraparteParty,
    contractee: formData.direcao === 'SAIDA' ? contraparteParty : own,
    service: {
      description: formData.descricao,
      value: formData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      paymentTerms: formData.formaPagamento,
      deadline: `${formData.startDate} a ${formData.endDate}`,
    },
    cityDate,
    categoria: formData.categoria,
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
