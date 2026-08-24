import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { TaxThermometerService, type TenantContext } from '@hexxa/core';

/**
 * Camada de dados pro servidor MCP (`/api/mcp`) e pra API REST de integração
 * externa (`/api/v1/*`) — funções que recebem `companyId` diretamente (já
 * resolvido do token de API, não da sessão do Clerk). Reaproveita as mesmas
 * consultas já usadas no dashboard e no Resumo do Mês, mas isoladas aqui pra
 * não acoplar essas rotas às páginas da UI.
 */

type Entry = {
  id: string;
  amount: number | string;
  type: 'PAYABLE' | 'RECEIVABLE';
  status: string;
  reference_month: string;
  due_date: string;
  description: string | null;
  category_name: string | null;
};

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function monthEndOf(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m!, 0).toISOString().slice(0, 10);
}
function isImposto(e: Entry) {
  return String(e.description || '').includes('Provisão de Imposto');
}
function emAberto(e: Entry) {
  return e.status === 'PENDING' || e.status === 'OVERDUE';
}
function sum(list: Entry[]) {
  return list.reduce((s, e) => s + Number(e.amount), 0);
}

export async function getFaturamentoTempoReal(companyId: string) {
  const now = new Date();
  const curMonth = monthKeyOf(now);
  const todayIso = now.toISOString().slice(0, 10);
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 6).toISOString().slice(0, 10);

  const rows = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      SELECT amount, type, status, reference_month, due_date, created_at
      FROM financial_entry
      WHERE company_id = ${companyId} AND status != 'CANCELED'
    `);
  });

  const receivables = (rows as any[]).filter((r) => r.type === 'RECEIVABLE');
  const createdIso = (r: any) => new Date(r.created_at).toISOString().slice(0, 10);

  return {
    hoje: sum(receivables.filter((r) => createdIso(r) === todayIso) as any),
    semana: sum(receivables.filter((r) => createdIso(r) >= weekStart && createdIso(r) <= weekEnd) as any),
    mes: sum(receivables.filter((r) => r.reference_month === curMonth) as any),
    pagamentosSemana: sum(
      (rows as any[]).filter((r) => r.type === 'PAYABLE' && r.due_date >= weekStart && r.due_date <= weekEnd) as any
    ),
    periodoSemana: { inicio: weekStart, fim: weekEnd },
  };
}

export async function getResumoMesAtual(companyId: string) {
  const now = new Date();
  const curMonth = monthKeyOf(now);
  const todayIso = now.toISOString().slice(0, 10);
  const nextMonthLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

  const entries = await withTenant(companyId, async (tx) => {
    const fe = await tx.execute(sql`
      SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
             c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${companyId} AND fe.reference_month = ${curMonth} AND fe.status != 'CANCELED'
    `);
    return fe as unknown as Entry[];
  });

  const payables = entries.filter((e) => e.type === 'PAYABLE');
  const receivables = entries.filter((e) => e.type === 'RECEIVABLE');
  const pagarAberto = sum(payables.filter(emAberto));
  const receberAberto = sum(receivables.filter(emAberto));

  const [contratosAtivos, notasEmitidas] = await withTenant(companyId, async (tx) => {
    const contracts = await tx.execute(sql`
      SELECT count(*)::int AS n FROM business_contract
      WHERE company_id = ${companyId} AND status = 'ATIVO'
        AND start_date <= ${monthEndOf(curMonth)} AND (end_date IS NULL OR end_date >= ${curMonth})
    `);
    const invoices = await tx.execute(sql`
      SELECT count(*)::int AS n FROM service_invoice
      WHERE company_id = ${companyId} AND status = 'ISSUED' AND reference_month = ${curMonth}
    `);
    return [Number(contracts[0]?.n ?? 0), Number(invoices[0]?.n ?? 0)];
  });

  return {
    mes: curMonth.slice(0, 7),
    aPagar: { total: sum(payables), emAberto: pagarAberto },
    aReceber: { total: sum(receivables), emAberto: receberAberto },
    impostos: {
      total: sum(payables.filter(isImposto)),
      emAberto: sum(payables.filter((e) => isImposto(e) && emAberto(e))),
      pagamentoEm: nextMonthLabel,
    },
    saldoProjetado: receberAberto - pagarAberto,
    contratosAtivos,
    notasEmitidas,
    compromissosVencidosHoje: entries.filter((e) => e.status === 'PENDING' && e.due_date < todayIso).length,
  };
}

export async function getResumoMes(companyId: string, mesInput?: string) {
  const now = new Date();
  let target: Date;
  if (mesInput && /^\d{4}-\d{2}$/.test(mesInput)) {
    const [y, m] = mesInput.split('-').map(Number);
    target = new Date(y!, m! - 1, 1);
  } else {
    target = new Date(now.getFullYear(), now.getMonth() - 1, 1); // mês anterior por padrão
  }
  const key = monthKeyOf(target);
  const monthEnd = monthEndOf(key);
  const label = target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const todayIso = now.toISOString().slice(0, 10);

  const data = await withTenant(companyId, async (tx) => {
    const fe = await tx.execute(sql`
      SELECT fe.id, fe.amount, fe.type, fe.status, fe.reference_month, fe.due_date, fe.description,
             c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${companyId} AND fe.reference_month = ${key} AND fe.status != 'CANCELED'
    `);
    const contracts = await tx.execute(sql`
      SELECT count(*)::int AS n FROM business_contract
      WHERE company_id = ${companyId} AND status = 'ATIVO'
        AND start_date <= ${monthEnd} AND (end_date IS NULL OR end_date >= ${key})
    `);
    const invoices = await tx.execute(sql`
      SELECT count(*)::int AS n FROM service_invoice
      WHERE company_id = ${companyId} AND status = 'ISSUED' AND reference_month = ${key}
    `);
    const newCustomers = await tx.execute(sql`
      SELECT count(*)::int AS n FROM customer
      WHERE company_id = ${companyId} AND created_at >= ${key} AND created_at <= ${monthEnd}
    `);
    const events = await tx.execute(sql`
      SELECT ee.type FROM employment_event ee
      JOIN employee e ON e.id = ee.employee_id
      WHERE e.company_id = ${companyId} AND ee.event_date >= ${key} AND ee.event_date <= ${monthEnd}
    `);
    const distributions = await tx.execute(sql`
      SELECT coalesce(sum(amount), 0) AS total FROM profit_distribution
      WHERE company_id = ${companyId} AND distributed_at >= ${key} AND distributed_at <= ${monthEnd}
    `);
    return {
      entries: fe as unknown as Entry[],
      contratosAtivos: Number(contracts[0]?.n ?? 0),
      notasEmitidas: Number(invoices[0]?.n ?? 0),
      novosClientes: Number(newCustomers[0]?.n ?? 0),
      admissoes: (events as any[]).filter((e) => e.type === 'ADMISSION').length,
      desligamentos: (events as any[]).filter((e) => e.type === 'TERMINATION').length,
      lucroDistribuido: Number(distributions[0]?.total ?? 0),
    };
  });

  const payables = data.entries.filter((e) => e.type === 'PAYABLE');
  const receivables = data.entries.filter((e) => e.type === 'RECEIVABLE');
  const faturamento = sum(receivables);
  const despesas = sum(payables);
  const inadimplente = sum(receivables.filter((e) => e.status !== 'PAID' && e.due_date < todayIso));

  return {
    mes: key.slice(0, 7),
    label,
    faturamento,
    despesas,
    lucro: faturamento - despesas,
    impostos: sum(payables.filter(isImposto)),
    contratosAtivos: data.contratosAtivos,
    notasEmitidas: data.notasEmitidas,
    novosClientes: data.novosClientes,
    colaboradores: { admissoes: data.admissoes, desligamentos: data.desligamentos },
    lucroDistribuido: data.lucroDistribuido,
    inadimplencia: {
      valor: inadimplente,
      taxa: faturamento > 0 ? inadimplente / faturamento : 0,
    },
  };
}

export async function getBussolaTributaria(companyId: string) {
  const ctx: TenantContext = { companyId, companyType: 'SERVICE', userId: 'mcp' };
  const simplesInputs = await getSimplesInputs(ctx);
  const simples = new TaxThermometerService().simplesPosition({
    rbt12: simplesInputs.rbt12,
    payroll12: simplesInputs.folha12,
  });
  return {
    anexo: simples.anexo,
    faixa: simples.faixa,
    aliquotaNominal: simples.nominalRate,
    aliquotaEfetiva: simples.effectiveRate,
    fatorR: simples.fatorR,
    fatorRFavoravel: simples.fatorRFavorable,
    faltaParaProximaFaixa: simples.toNextFaixa,
    proximaAliquota: simples.nextRate,
    percentualDoTeto: simples.ceilingUsagePct,
  };
}

export async function listContas(
  companyId: string,
  opts: { tipo: 'pagar' | 'receber'; status?: 'aberto' | 'vencido' | 'pago'; mes?: string }
) {
  const type = opts.tipo === 'pagar' ? 'PAYABLE' : 'RECEIVABLE';
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthFilter = opts.mes && /^\d{4}-\d{2}$/.test(opts.mes) ? `${opts.mes}-01` : null;

  const rows = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      SELECT fe.description, fe.amount, fe.due_date, fe.status, fe.reference_month, c.name AS category_name
      FROM financial_entry fe
      LEFT JOIN category c ON c.id = fe.category_id
      WHERE fe.company_id = ${companyId} AND fe.type = ${type} AND fe.status != 'CANCELED'
        ${monthFilter ? sql`AND fe.reference_month = ${monthFilter}` : sql``}
      ORDER BY fe.due_date ASC
      LIMIT 100
    `);
  });

  const filtered = (rows as any[]).filter((r) => {
    if (!opts.status) return true;
    if (opts.status === 'pago') return r.status === 'PAID';
    if (opts.status === 'vencido') return r.status !== 'PAID' && r.due_date < todayIso;
    return r.status !== 'PAID' && r.due_date >= todayIso; // aberto
  });

  return filtered.map((r) => ({
    descricao: r.description,
    valor: Number(r.amount),
    vencimento: String(r.due_date).slice(0, 10),
    categoria: r.category_name || 'Outros',
    status: r.status === 'PAID' ? 'pago' : r.due_date < todayIso ? 'vencido' : 'aberto',
  }));
}

// ── Escrita (API REST /api/v1/*, exige token com scope 'write') ────────────

type LancamentoInput = {
  descricao: string;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  categoria?: string;
  recebidoOuPago?: boolean;
};

async function getOrCreateCategoryId(companyId: string, name: string | undefined, kind: 'INCOME' | 'EXPENSE') {
  if (!name?.trim()) return null;
  return withTenant(companyId, async (tx) => {
    const existing = await tx.execute(sql`
      SELECT id FROM category WHERE company_id = ${companyId} AND name = ${name.trim()} AND kind = ${kind} LIMIT 1
    `);
    if (existing[0]) return existing[0].id as string;
    const created = await tx.execute(sql`
      INSERT INTO category (company_id, name, kind) VALUES (${companyId}, ${name.trim()}, ${kind}) RETURNING id
    `);
    return created[0]!.id as string;
  });
}

function validateLancamento(input: LancamentoInput) {
  if (!input.descricao?.trim()) throw new Error('"descricao" é obrigatória.');
  if (!(input.valor > 0)) throw new Error('"valor" precisa ser um número positivo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vencimento)) throw new Error('"vencimento" precisa estar no formato AAAA-MM-DD.');
}

/** Lança uma despesa (conta a pagar) — usado pela API REST de integração externa. */
export async function createDespesa(companyId: string, input: LancamentoInput) {
  validateLancamento(input);
  const categoryId = await getOrCreateCategoryId(companyId, input.categoria, 'EXPENSE');
  const referenceMonth = input.vencimento.slice(0, 8) + '01';
  const status = input.recebidoOuPago ? 'PAID' : 'PENDING';

  const [created] = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, category_id, paid_at)
      VALUES (${companyId}, 'PAYABLE', ${input.descricao.trim()}, ${String(input.valor)}, ${input.vencimento}, ${referenceMonth}, ${status}, 'API', ${categoryId}, ${input.recebidoOuPago ? input.vencimento : null})
      RETURNING id
    `);
  });

  return { id: created!.id as string, status };
}

/** Lança um faturamento (conta a receber) — usado pela API REST de integração externa. */
export async function createFaturamento(companyId: string, input: LancamentoInput) {
  validateLancamento(input);
  const categoryId = await getOrCreateCategoryId(companyId, input.categoria, 'INCOME');
  const referenceMonth = input.vencimento.slice(0, 8) + '01';
  const status = input.recebidoOuPago ? 'PAID' : 'PENDING';

  const [created] = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, category_id, paid_at)
      VALUES (${companyId}, 'RECEIVABLE', ${input.descricao.trim()}, ${String(input.valor)}, ${input.vencimento}, ${referenceMonth}, ${status}, 'API', ${categoryId}, ${input.recebidoOuPago ? input.vencimento : null})
      RETURNING id
    `);
  });

  return { id: created!.id as string, status };
}
