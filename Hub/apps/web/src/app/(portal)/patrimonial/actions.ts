'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { revalidatePath } from 'next/cache';
import { gerarLancamentosDoAluguel } from '@/lib/server/contract-financials';
import { makeContractSignatureService } from '@/lib/server/container';
import { indiceAcumulado12m } from '@/lib/server/contratos';
import { TAXAS, type TipoDeBem } from './lib';

const TIPO_PARA_BANCO: Record<TipoDeBem, string> = {
  'Imóvel': 'COMMERCIAL',
  'Terreno': 'LAND',
  'Veículo': 'VEHICLE',
  'Máquina ou Equipamento': 'MACHINERY',
  'Móveis e Utensílios': 'FURNITURE',
  'Equipamento de Informática': 'IT_EQUIPMENT',
  'Outro': 'OTHER',
};

const BANCO_PARA_TIPO: Record<string, TipoDeBem> = {
  APARTMENT: 'Imóvel',
  HOUSE: 'Imóvel',
  COMMERCIAL: 'Imóvel',
  LAND: 'Terreno',
  VEHICLE: 'Veículo',
  MACHINERY: 'Máquina ou Equipamento',
  FURNITURE: 'Móveis e Utensílios',
  IT_EQUIPMENT: 'Equipamento de Informática',
  OTHER: 'Outro',
};

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export type PropertyRow = {
  id: string;
  name: string;
  kind: TipoDeBem;
  acq: number;
  /** Data da compra (AAAA-MM-DD). */
  compra: string;
  endereco: string | null;
  rent: number;
  rate: number;
  ownerType: 'PJ' | 'PF';
  partnerId: string | null;
  partnerName: string | null;
  leaseId: string | null;
  status: string;
};

export async function getProperties(): Promise<PropertyRow[]> {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return await tx.execute(sql`
      SELECT
        p.id, p.label as name, p.kind, p.acquisition_value as acq, p.address,
        to_char(coalesce(p.acquisition_date, p.created_at::date), 'YYYY-MM-DD') AS compra,
        p.depreciation_rate, p.owner_type, p.partner_id, p.status,
        pt.name as partner_name,
        l.id as lease_id,
        COALESCE(l.monthly_rent, 0) as rent
      FROM property p
      LEFT JOIN lease l ON l.property_id = p.id AND l.status = 'ACTIVE'
      LEFT JOIN partner pt ON pt.id = p.partner_id
      WHERE p.company_id = ${ctx.companyId}
      ORDER BY p.acquisition_value DESC NULLS LAST, p.created_at DESC
    `);
  });

  return data.map((row: any) => {
    const kind = BANCO_PARA_TIPO[row.kind as string] ?? 'Outro';
    return {
      id: row.id,
      name: row.name,
      kind,
      acq: Number(row.acq || 0),
      compra: row.compra,
      endereco: row.address ?? null,
      rent: Number(row.rent || 0),
      rate: row.depreciation_rate == null ? TAXAS[kind].rate : Number(row.depreciation_rate),
      ownerType: (row.owner_type as 'PJ' | 'PF') ?? 'PJ',
      partnerId: row.partner_id ?? null,
      partnerName: row.partner_name ?? null,
      leaseId: row.lease_id ?? null,
      status: row.status,
    };
  });
}

/** Cadastra ou edita um bem. A taxa de depreciação é a do tipo. */
export async function salvarBemAction(input: {
  id?: string;
  nome: string;
  tipo: TipoDeBem;
  valor: number;
  compra: string;
  endereco?: string;
  dono: 'PJ' | 'PF';
  socioId?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const nome = input.nome.trim();
  if (!nome) return { ok: false, message: 'Dê um nome ao bem.' };
  if (!(input.valor > 0)) return { ok: false, message: 'Informe quanto o bem custou.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.compra) || input.compra > hoje()) return { ok: false, message: 'Informe a data da compra (até hoje).' };
  if (!TAXAS[input.tipo]) return { ok: false, message: 'Tipo de bem inválido.' };
  const socioId = input.dono === 'PF' ? input.socioId || null : null;
  if (input.dono === 'PF' && !socioId) return { ok: false, message: 'Escolha de qual sócio é o bem.' };
  const kind = TIPO_PARA_BANCO[input.tipo];
  const taxa = TAXAS[input.tipo].rate;
  const endereco = input.endereco?.trim() || null;

  await withTenant(ctx.companyId, async (tx) => {
    if (input.id) {
      await tx.execute(sql`
        UPDATE property SET label = ${nome}, kind = ${kind}::property_kind, acquisition_value = ${input.valor},
               acquisition_date = ${input.compra}, depreciation_rate = ${taxa}, owner_type = ${input.dono},
               partner_id = ${socioId}, address = ${endereco}
         WHERE id = ${input.id}::uuid AND company_id = ${ctx.companyId}
      `);
    } else {
      await tx.execute(sql`
        INSERT INTO property (company_id, label, kind, acquisition_value, status, acquisition_date, depreciation_rate, owner_type, partner_id, address)
        VALUES (${ctx.companyId}, ${nome}, ${kind}::property_kind, ${input.valor}, 'AVAILABLE', ${input.compra}, ${taxa}, ${input.dono}, ${socioId}, ${endereco})
      `);
    }
  });
  revalidatePath('/patrimonial');
  return { ok: true, message: input.id ? 'Bem atualizado.' : 'Bem cadastrado.' };
}

/** Exclui um bem — só se não estiver alugado (o aluguel precisa ser encerrado antes). */
export async function excluirBemAction(id: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const [aluguel] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`SELECT 1 FROM lease WHERE property_id = ${id}::uuid AND company_id = ${ctx.companyId} AND status IN ('ACTIVE', 'PENDING_SIGNATURE')`),
  )) as unknown as unknown[];
  if (aluguel) return { ok: false, message: 'Este bem está alugado. Encerre o aluguel antes de excluir.' };
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`DELETE FROM lease WHERE property_id = ${id}::uuid AND company_id = ${ctx.companyId}`);
    await tx.execute(sql`DELETE FROM property WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}`);
  });
  revalidatePath('/patrimonial');
  return { ok: true, message: 'Bem excluído.' };
}

// ── Aluguéis ────────────────────────────────────────────────────────────────

export type LeaseRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  lesseeName: string;
  monthlyRent: number;
  indexType: 'IPCA' | 'IGPM';
  adjustmentAnchor: string;
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'ENDED' | 'CANCELED';
  startDate: string | null;
  endDate: string | null;
};

export type RentPaymentRow = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  hasReceipt: boolean;
};

export async function listLeasesAction(): Promise<LeaseRow[]> {
  const ctx = await getTenantContext();
  const data = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT l.id, l.property_id, p.label as property_name, l.lessee_name, l.monthly_rent, l.index_type,
             to_char(l.adjustment_anchor, 'YYYY-MM-DD') AS adjustment_anchor, l.status,
             to_char(l.start_date, 'YYYY-MM-DD') AS start_date, to_char(l.end_date, 'YYYY-MM-DD') AS end_date
      FROM lease l
      JOIN property p ON p.id = l.property_id
      WHERE l.company_id = ${ctx.companyId}
      ORDER BY l.status = 'ACTIVE' DESC, l.start_date DESC NULLS LAST
    `);
  });
  return data.map((r: any) => ({
    id: r.id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    lesseeName: r.lessee_name,
    monthlyRent: Number(r.monthly_rent),
    indexType: r.index_type,
    adjustmentAnchor: r.adjustment_anchor,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
  }));
}

/** Os recebimentos do aluguel (sem as provisões de imposto). */
export async function getRentPaymentsAction(leaseId: string): Promise<RentPaymentRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT id, description, amount, to_char(due_date, 'YYYY-MM-DD') AS due_date, status,
             to_char(paid_at, 'YYYY-MM-DD') AS paid_at, receipt_base64 IS NOT NULL AS has_receipt
      FROM financial_entry
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId}::uuid AND type = 'RECEIVABLE'
        AND status <> 'CANCELED'
      ORDER BY due_date
    `);
  });
  return rows.map((r: any) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    dueDate: r.due_date,
    status: r.status,
    paidAt: r.paid_at,
    hasReceipt: !!r.has_receipt,
  }));
}

export async function createLeaseAction(input: {
  propertyId: string;
  lesseeName: string;
  monthlyRent: number;
  indexType: 'IPCA' | 'IGPM';
  startDate: string;
  endDate?: string;
}): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if (!input.propertyId) return { ok: false, message: 'Escolha o imóvel.' };
  if (!input.lesseeName.trim()) return { ok: false, message: 'Informe quem está alugando.' };
  if (!input.monthlyRent || input.monthlyRent <= 0) return { ok: false, message: 'Informe o valor do aluguel.' };
  if (!input.startDate) return { ok: false, message: 'Informe o início do contrato.' };
  if (input.endDate && input.endDate <= input.startDate) return { ok: false, message: 'O fim precisa ser depois do início.' };

  const [lease] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      INSERT INTO lease (company_id, property_id, lessee_name, monthly_rent, index_type, adjustment_anchor, status, start_date, end_date)
      SELECT ${ctx.companyId}, p.id, ${input.lesseeName.trim()}, ${input.monthlyRent}, ${input.indexType}::index_type, ${input.startDate}, 'ACTIVE', ${input.startDate}, ${input.endDate || null}
        FROM property p WHERE p.id = ${input.propertyId}::uuid AND p.company_id = ${ctx.companyId}
      RETURNING id
    `);
  });
  if (!lease) return { ok: false, message: 'Imóvel não encontrado.' };

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`UPDATE property SET status = 'RENTED' WHERE id = ${input.propertyId}::uuid AND company_id = ${ctx.companyId}`);
  });

  try {
    await gerarLancamentosDoAluguel({
      companyId: ctx.companyId,
      leaseId: (lease as any).id,
      descricao: `Aluguel — ${input.lesseeName.trim()}`,
      valor: input.monthlyRent,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    });
  } catch (err) {
    // Sem os recebimentos o aluguel não serve: desfaz, em vez de deixá-lo pela metade.
    console.error('[aluguel] falha ao lançar os recebimentos:', err);
    await withTenant(ctx.companyId, async (tx) => {
      await tx.execute(sql`DELETE FROM lease WHERE id = ${(lease as any).id}`);
      await tx.execute(sql`UPDATE property SET status = 'AVAILABLE' WHERE id = ${input.propertyId}::uuid AND company_id = ${ctx.companyId}`);
    });
    return { ok: false, message: 'Não foi possível lançar os recebimentos no financeiro. Tente de novo.' };
  }

  revalidatePath('/patrimonial');
  return { ok: true, message: 'Aluguel registrado e recebimentos lançados no financeiro.' };
}

/** O índice acumulado em 12 meses (Banco Central), para sugerir o reajuste. */
export async function indiceDoAluguelAction(indice: 'IPCA' | 'IGPM') {
  return indiceAcumulado12m(indice);
}

export async function reajustarLeaseAction(leaseId: string, percentual: number): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  if (!(percentual > -50 && percentual < 100) || percentual === 0) return { ok: false, message: 'Informe o percentual do reajuste.' };
  const [current] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`SELECT monthly_rent FROM lease WHERE id = ${leaseId}::uuid AND company_id = ${ctx.companyId} AND status = 'ACTIVE'`);
  });
  if (!current) return { ok: false, message: 'Aluguel não encontrado.' };

  const antigo = Number((current as any).monthly_rent);
  const novoValor = Math.round(antigo * (1 + percentual / 100) * 100) / 100;
  const fator = novoValor / antigo;
  const dia = hoje();

  // Os meses em aberto a partir de hoje passam ao novo valor, e a provisão de
  // imposto de cada um acompanha na mesma proporção. Datas e numeração ficam.
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`UPDATE lease SET monthly_rent = ${novoValor}, adjustment_anchor = ${dia} WHERE id = ${leaseId}::uuid`);
    await tx.execute(sql`
      UPDATE financial_entry
         SET amount = CASE WHEN type = 'RECEIVABLE' THEN ${novoValor}::numeric ELSE round(amount * ${fator}::numeric, 2) END
       WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId}::uuid
         AND status = 'PENDING' AND due_date >= ${dia}
    `);
  });

  revalidatePath('/patrimonial');
  return { ok: true, message: `Reajuste aplicado — novo valor ${novoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês.` };
}

export async function encerrarLeaseAction(leaseId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  const [current] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`SELECT property_id, status, signature_request_id FROM lease WHERE id = ${leaseId}::uuid AND company_id = ${ctx.companyId}`);
  });
  if (!current) return { ok: false, message: 'Aluguel não encontrado.' };

  const wasPending = (current as any).status === 'PENDING_SIGNATURE' || (current as any).status === 'DRAFT';
  const newStatus = wasPending ? 'CANCELED' : 'ENDED';

  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`UPDATE lease SET status = ${newStatus}, end_date = coalesce(least(end_date, ${hoje()}::date), ${hoje()}::date) WHERE id = ${leaseId}::uuid AND company_id = ${ctx.companyId}`);
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'CANCELED'
      WHERE company_id = ${ctx.companyId} AND source = 'RENT' AND source_id = ${leaseId}::uuid AND status = 'PENDING' AND due_date > ${hoje()}
    `);
    await tx.execute(sql`UPDATE property SET status = 'AVAILABLE' WHERE id = ${(current as any).property_id}`);
  });

  const signatureRequestId = (current as any).signature_request_id as string | null;
  if (wasPending && signatureRequestId) {
    try {
      await makeContractSignatureService().cancel(ctx, signatureRequestId);
    } catch (err) {
      console.error('Erro ao cancelar pedido de assinatura do aluguel:', err);
    }
  }

  revalidatePath('/patrimonial');
  return {
    ok: true,
    message: wasPending ? 'Aluguel cancelado antes da assinatura.' : 'Aluguel encerrado. Os meses seguintes saíram do financeiro.',
  };
}

export async function marcarAluguelPagoAction(entryId: string): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE financial_entry SET status = 'PAID', paid_at = ${hoje()}
      WHERE id = ${entryId}::uuid AND company_id = ${ctx.companyId} AND source = 'RENT' AND type = 'RECEIVABLE'
    `);
  });
  revalidatePath('/patrimonial');
  revalidatePath('/meu-negocio/hub-financeiro');
  return { ok: true, message: 'Aluguel marcado como recebido.' };
}
