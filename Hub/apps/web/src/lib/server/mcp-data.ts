import 'server-only';
import { withTenant, sql, getDb, company } from '@hexxa/db';
import { ilike, or, eq } from 'drizzle-orm';
import { getSimplesInputs } from '@/lib/server/fiscal';
import { TaxThermometerService, type TenantContext } from '@hexxa/core';

export type CompanyInfo = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  type: 'SERVICE' | 'HOLDING';
};

/**
 * Busca empresas cadastradas no Hub (por nome fantasia, razão social ou CNPJ).
 * Se termo for omitido, retorna as primeiras 50 empresas.
 */
export async function searchCompanies(term?: string): Promise<CompanyInfo[]> {
  const db = getDb();
  if (!term || !term.trim()) {
    const rows = await db
      .select({
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        type: company.type,
      })
      .from(company)
      .limit(50);
    return rows as CompanyInfo[];
  }

  const clean = term.trim();
  const digits = clean.replace(/\D/g, '');
  const pattern = `%${clean}%`;

  const rows = await db
    .select({
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      cnpj: company.cnpj,
      type: company.type,
    })
    .from(company)
    .where(
      or(
        ilike(company.legalName, pattern),
        ilike(company.tradeName, pattern),
        ilike(company.cnpj, pattern),
        digits.length >= 4 ? sql`regexp_replace(${company.cnpj}, '\\D', '', 'g') ILIKE ${'%' + digits + '%'}` : sql`false`
      )
    )
    .limit(20);

  return rows as CompanyInfo[];
}

/**
 * Resolve a empresa alvo para uma consulta MCP:
 * - Se `clienteInput` for vazio: retorna a empresa padrão associada ao token.
 * - Se `clienteInput` for informado: exige `isAdmin: true` e pesquisa por UUID, CNPJ ou Nome.
 */
export async function resolveTargetCompany(
  clienteInput: string | undefined,
  defaultCompanyId: string,
  isAdmin: boolean
): Promise<CompanyInfo> {
  const db = getDb();

  if (!clienteInput || !clienteInput.trim()) {
    const [found] = await db
      .select({
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        type: company.type,
      })
      .from(company)
      .where(eq(company.id, defaultCompanyId));

    if (!found) throw new Error(`Empresa associada ao token (${defaultCompanyId}) não encontrada.`);
    return found as CompanyInfo;
  }

  if (!isAdmin) {
    throw new Error('Acesso negado: apenas tokens com perfil de Administrador/Contador podem consultar dados de outras empresas.');
  }

  const clean = clienteInput.trim();

  // UUID direto
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    const [found] = await db
      .select({
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj: company.cnpj,
        type: company.type,
      })
      .from(company)
      .where(eq(company.id, clean));
    if (found) return found as CompanyInfo;
  }

  const results = await searchCompanies(clean);
  if (results.length === 0) {
    throw new Error(`Nenhum cliente encontrado para o termo "${clean}". Use a ferramenta "buscar_clientes" para ver as empresas disponíveis.`);
  }
  if (results.length > 1) {
    const matches = results.map((r) => `"${r.tradeName || r.legalName}" (${r.cnpj})`).join(', ');
    throw new Error(`Mais de um cliente encontrado para "${clean}": ${matches}. Por favor, especifique o CNPJ ou o nome completo.`);
  }

  return results[0]!;
}

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

/**
 * Consulta contratos ativos e vigentes da empresa (receitas e despesas recorrentes).
 */
export async function listContratos(companyId: string) {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      id,
      title,
      type,
      party_name,
      party_cnpj,
      value,
      due_day,
      start_date,
      end_date,
      status
    FROM business_contract
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const list = (rows as any[]).map((r) => ({
    id: r.id,
    titulo: r.title,
    tipo: r.type === 'ENTRADA' ? 'receita_recorrente' : 'despesa_recorrente',
    contraparte: r.party_name,
    cnpjContraparte: r.party_cnpj,
    valorMensal: Number(r.value),
    diaVencimento: r.due_day,
    inicio: r.start_date,
    fim: r.end_date,
    status: r.status,
  }));

  const totalReceitaRecorrente = list
    .filter((c) => c.tipo === 'receita_recorrente' && c.status === 'ACTIVE')
    .reduce((acc, c) => acc + c.valorMensal, 0);

  const totalDespesaRecorrente = list
    .filter((c) => c.tipo === 'despesa_recorrente' && c.status === 'ACTIVE')
    .reduce((acc, c) => acc + c.valorMensal, 0);

  return {
    totalContratos: list.length,
    mrrRecorrenciaAtiva: totalReceitaRecorrente,
    despesaRecorrenteAtiva: totalDespesaRecorrente,
    contratos: list,
  };
}

/**
 * Consulta guias de impostos (DAS, INSS, ISS, etc.) da empresa.
 */
export async function listGuiasImpostos(companyId: string, filter?: { status?: string; mes?: string }) {
  const db = getDb();
  let query = sql`
    SELECT
      id,
      tax_name,
      reference_month,
      amount,
      due_date,
      status,
      pix_code IS NOT NULL as tem_pix
    FROM tax_guide
    WHERE company_id = ${companyId}
  `;

  if (filter?.status) {
    const statusMap: Record<string, string> = {
      aberto: 'OPEN',
      pago: 'PAID',
      vencido: 'OVERDUE',
    };
    const s = statusMap[filter.status] || filter.status.toUpperCase();
    query = sql`${query} AND status = ${s}`;
  }

  if (filter?.mes) {
    const refMonth = filter.mes.slice(0, 7) + '-01';
    query = sql`${query} AND reference_month = ${refMonth}`;
  }

  query = sql`${query} ORDER BY due_date DESC LIMIT 50`;

  const rows = await db.execute(query);
  const guias = (rows as any[]).map((r) => ({
    id: r.id,
    imposto: r.tax_name,
    mesReferencia: String(r.reference_month).slice(0, 7),
    valor: Number(r.amount),
    vencimento: String(r.due_date).slice(0, 10),
    status: r.status === 'PAID' ? 'pago' : r.status === 'OVERDUE' ? 'vencido' : 'aberto',
    temPix: Boolean(r.tem_pix),
  }));

  const totalAberto = guias.filter((g) => g.status !== 'pago').reduce((acc, g) => acc + g.valor, 0);

  return {
    totalGuias: guias.length,
    totalPendente: totalAberto,
    guias,
  };
}

/**
 * Relatório de inadimplência:
 * - Se informado `companyId`: inadimplência dos clientes daquela empresa específica.
 * - Se `isAdmin` e sem `companyId`: inadimplência global da carteira inteira do escritório.
 */
export async function getRelatorioInadimplencia(companyId?: string, isAdmin?: boolean) {
  const db = getDb();

  const whereClause = companyId
    ? sql`fe.company_id = ${companyId} AND fe.type = 'RECEIVABLE' AND (fe.status = 'OVERDUE' OR (fe.due_date < CURRENT_DATE AND fe.status = 'PENDING'))`
    : sql`fe.type = 'RECEIVABLE' AND (fe.status = 'OVERDUE' OR (fe.due_date < CURRENT_DATE AND fe.status = 'PENDING'))`;

  const rows = await db.execute(sql`
    SELECT
      fe.id,
      fe.company_id,
      c.trade_name,
      c.legal_name,
      c.cnpj,
      fe.description,
      fe.amount,
      fe.due_date,
      fe.status,
      CURRENT_DATE - fe.due_date as dias_atraso
    FROM financial_entry fe
    JOIN company c ON c.id = fe.company_id
    WHERE ${whereClause}
    ORDER BY fe.due_date ASC
    LIMIT 100
  `);

  const list = (rows as any[]).map((r) => ({
    id: r.id,
    empresa: {
      id: r.company_id,
      nome: r.trade_name || r.legal_name,
      cnpj: r.cnpj,
    },
    descricao: r.description,
    valor: Number(r.amount),
    vencimento: String(r.due_date).slice(0, 10),
    diasAtraso: Math.max(0, Number(r.dias_atraso || 0)),
  }));

  const totalEmAtraso = list.reduce((acc, item) => acc + item.valor, 0);

  return {
    totalTitulosEmAtraso: list.length,
    valorTotalInadimplente: totalEmAtraso,
    titulos: list,
  };
}

/**
 * Panorama macro de toda a carteira de clientes (apenas para Admin/Contador).
 */
export async function getPanoramaCarteira() {
  const db = getDb();
  const now = new Date();
  const curMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const companiesRows = await db.execute(sql`
    SELECT id, legal_name, trade_name, cnpj, type
    FROM company
    ORDER BY created_at ASC
  `);

  const entriesRows = await db.execute(sql`
    SELECT
      company_id,
      type,
      status,
      amount,
      reference_month,
      due_date < CURRENT_DATE as vencido
    FROM financial_entry
    WHERE status != 'CANCELED'
  `);

  const entries = entriesRows as any[];
  const companies = companiesRows as any[];

  let faturamentoTotalMes = 0;
  let inadimplenciaTotal = 0;
  let aPagarTotalMes = 0;

  const resumoPorEmpresa = companies.map((c) => {
    const empEntries = entries.filter((e) => e.company_id === c.id);

    const faturadoMes = empEntries
      .filter((e) => e.type === 'RECEIVABLE' && String(e.reference_month).startsWith(curMonthStart.slice(0, 7)))
      .reduce((s, e) => s + Number(e.amount), 0);

    const atrasado = empEntries
      .filter((e) => e.type === 'RECEIVABLE' && (e.status === 'OVERDUE' || (e.vencido && e.status === 'PENDING')))
      .reduce((s, e) => s + Number(e.amount), 0);

    const aPagarMes = empEntries
      .filter((e) => e.type === 'PAYABLE' && String(e.reference_month).startsWith(curMonthStart.slice(0, 7)))
      .reduce((s, e) => s + Number(e.amount), 0);

    faturamentoTotalMes += faturadoMes;
    inadimplenciaTotal += atrasado;
    aPagarTotalMes += aPagarMes;

    return {
      id: c.id,
      nome: c.trade_name || c.legal_name,
      cnpj: c.cnpj,
      tipo: c.type,
      faturamentoMesAtual: faturadoMes,
      inadimplenciaEmAberto: atrasado,
      contasPagarMesAtual: aPagarMes,
    };
  });

  return {
    mesReferencia: curMonthStart.slice(0, 7),
    totalEmpresasCadastradas: companies.length,
    faturamentoConsolidadoCarteira: faturamentoTotalMes,
    inadimplenciaConsolidadaCarteira: inadimplenciaTotal,
    despesasConsolidadasCarteira: aPagarTotalMes,
    carteira: resumoPorEmpresa,
  };
}

/**
 * Calcula a previsão de lucro contábil e o valor disponível para distribuição
 * aos sócios no mês atual e no acumulado do ano.
 */
export async function getPrevisaoLucroDistribuicao(companyId: string) {
  const db = getDb();
  const now = new Date();
  const year = now.getFullYear();
  const curMonth = monthKeyOf(now);
  const monthEnd = monthEndOf(curMonth);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [entriesMonth, entriesYear, distRowsYear, distRowsMonth] = await Promise.all([
    db.execute(sql`
      SELECT type, status, amount
      FROM financial_entry
      WHERE company_id = ${companyId} AND reference_month = ${curMonth} AND status != 'CANCELED'
    `),
    db.execute(sql`
      SELECT type, status, amount
      FROM financial_entry
      WHERE company_id = ${companyId} AND reference_month >= ${yearStart} AND reference_month <= ${yearEnd} AND status != 'CANCELED'
    `),
    db.execute(sql`
      SELECT coalesce(sum(amount), 0) AS total
      FROM profit_distribution
      WHERE company_id = ${companyId} AND reference_year = ${year}
    `),
    db.execute(sql`
      SELECT coalesce(sum(amount), 0) AS total
      FROM profit_distribution
      WHERE company_id = ${companyId} AND distributed_at >= ${curMonth} AND distributed_at <= ${monthEnd}
    `),
  ]);

  const mEntries = entriesMonth as any[];
  const yEntries = entriesYear as any[];

  // Mês Atual
  const receitaMes = mEntries.filter((e) => e.type === 'RECEIVABLE').reduce((s, e) => s + Number(e.amount), 0);
  const despesaMes = mEntries.filter((e) => e.type === 'PAYABLE').reduce((s, e) => s + Number(e.amount), 0);
  const lucroLiquidoProjetadoMes = receitaMes - despesaMes;
  const distribuidoMes = Number((distRowsMonth as any[])[0]?.total ?? 0);
  const saldoLucroDisponivelMes = Math.max(0, lucroLiquidoProjetadoMes - distribuidoMes);

  // Acumulado do Ano
  const receitaAno = yEntries.filter((e) => e.type === 'RECEIVABLE').reduce((s, e) => s + Number(e.amount), 0);
  const despesaAno = yEntries.filter((e) => e.type === 'PAYABLE').reduce((s, e) => s + Number(e.amount), 0);
  const lucroLiquidoAcumuladoAno = receitaAno - despesaAno;
  const distribuidoAno = Number((distRowsYear as any[])[0]?.total ?? 0);
  const lucroDisponivelAcumuladoAno = Math.max(0, lucroLiquidoAcumuladoAno - distribuidoAno);

  return {
    mesReferencia: curMonth.slice(0, 7),
    anoReferencia: year,
    mesAtual: {
      receitasPrevistas: receitaMes,
      despesasPrevistas: despesaMes,
      lucroLiquidoProjetado: lucroLiquidoProjetadoMes,
      jaDistribuidoNoMes: distribuidoMes,
      disponivelParaDistribuirEsteMes: saldoLucroDisponivelMes,
    },
    acumuladoAno: {
      receitasAno: receitaAno,
      despesasAno: despesaAno,
      lucroLiquidoTotalAno: lucroLiquidoAcumuladoAno,
      jaDistribuidoNoAno: distribuidoAno,
      lucroTotalAindaDisponivelNoAno: lucroDisponivelAcumuladoAno,
    },
    orientacaoContabil:
      'A distribuição de lucros aos sócios é 100% isenta de IRPF desde que haja lucro contábil apurado e a empresa não possua débitos previdenciários (INSS) ou tributários não parcelados.',
  };
}


