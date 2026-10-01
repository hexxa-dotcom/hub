import 'server-only';
import { withTenant, sql, getDb, eq, and } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { renderReciboAluguelPdf, type ReciboAluguelData } from './recibo-aluguel-pdf';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtDataBr(iso?: string | null): string {
  if (!iso) return '—';
  const clean = iso.slice(0, 10);
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

function fmtMesRef(refMonth?: string | null): string {
  if (!refMonth) return '—';
  const clean = refMonth.slice(0, 10);
  const [y, m] = clean.split('-').map(Number);
  if (!y || !m) return refMonth;
  const mesNome = MESES[m - 1] || String(m);
  return `${mesNome}/${y}`;
}

function formatAddress(c: {
  addressLine1?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const parts = [
    c.addressLine1 ? `${c.addressLine1}, ${c.addressNumber || 's/n'}` : null,
    c.neighborhood,
    c.city && c.state ? `${c.city}/${c.state}` : (c.city ?? c.state ?? null),
  ].filter(Boolean);
  return parts.join(' — ') || 'Endereço cadastrado na Hexx';
}

/**
 * Retorna os dados completos do recibo a partir de um lançamento financeiro
 * de aluguel (financial_entry com source='RENT').
 */
export async function obterDadosReciboAluguel(
  ctx: TenantContext,
  entryId: string,
): Promise<ReciboAluguelData | null> {
  const data = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT
        fe.id AS entry_id,
        fe.amount,
        to_char(fe.due_date, 'YYYY-MM-DD') AS due_date,
        to_char(fe.reference_month, 'YYYY-MM-DD') AS reference_month,
        to_char(fe.paid_at, 'YYYY-MM-DD') AS paid_at,
        fe.status AS entry_status,
        l.id AS lease_id,
        l.lessee_name,
        l.monthly_rent,
        p.label AS property_name,
        p.address AS property_address,
        c.legal_name AS company_name,
        c.cnpj AS company_cnpj,
        c.email AS company_email,
        c.address_line1,
        c.address_number,
        c.neighborhood,
        c.city,
        c.state
      FROM financial_entry fe
      JOIN lease l ON l.id = fe.source_id AND l.company_id = fe.company_id
      JOIN property p ON p.id = l.property_id AND p.company_id = fe.company_id
      JOIN company c ON c.id = fe.company_id
      WHERE fe.id = ${entryId}::uuid
        AND fe.company_id = ${ctx.companyId}
        AND fe.source = 'RENT' AND fe.type = 'RECEIVABLE' AND fe.status <> 'CANCELED'
      LIMIT 1
    `);
  });

  const row = (data as any[])[0];
  if (!row) return null;

  const locadorEndereco = formatAddress({
    addressLine1: row.address_line1,
    addressNumber: row.address_number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
  });

  const refClean = (row.reference_month || '').slice(0, 7).replace('-', '');
  const shortId = row.entry_id.slice(0, 6).toUpperCase();
  const numRecibo = `REC-${refClean}-${shortId}`;

  const isPaid = row.entry_status === 'PAID';
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const isOverdue = !isPaid && row.due_date < hoje;

  // Busca dados adicionais do cliente/locatário se cadastrado
  const [cust] = await withTenant(ctx.companyId, async (tx) => {
    return tx.execute(sql`
      SELECT name, document, email, address
      FROM customer
      WHERE company_id = ${ctx.companyId}
        AND (name ILIKE ${row.lessee_name} OR document ILIKE ${row.lessee_name})
      LIMIT 1
    `);
  });

  const locatarioDoc = (cust as any)?.document || 'Não informado';
  const locatarioEnd = (cust as any)?.address || row.property_address || 'Mesmo do imóvel locado';
  const locatarioEmail = (cust as any)?.email || null;

  const hojeBr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
  const cidade = row.city ? `${row.city} - ${row.state || 'UF'}` : 'São Paulo - SP';

  return {
    numeroRecibo: numRecibo,
    mesReferencia: fmtMesRef(row.reference_month),
    dataVencimento: fmtDataBr(row.due_date),
    dataPagamento: isPaid ? (row.paid_at ? fmtDataBr(row.paid_at) : null) : null,
    status: isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING',
    locador: {
      nome: row.company_name,
      documento: row.company_cnpj,
      endereco: locadorEndereco,
      email: row.company_email,
    },
    locatario: {
      nome: row.lessee_name,
      documento: locatarioDoc,
      endereco: locatarioEnd,
      email: locatarioEmail,
    },
    imovel: {
      label: row.property_name,
      endereco: row.property_address || 'Endereço não informado',
    },
    valores: {
      aluguel: Number(row.amount),
      total: Number(row.amount),
    },

    codigoVerificacao: shortId,
    cidadeData: `${cidade}, ${hojeBr}`,
  };
}

/**
 * Gera dados fictícios porém completos de uma Holding e seu inquilino,
 * para prévia visual e testes de layout.
 */
export function obterDadosReciboExemplo(): ReciboAluguelData {
  const hojeBr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });

  return {
    numeroRecibo: 'REC-202609-H7B49F',
    mesReferencia: 'Setembro de 2026',
    dataVencimento: '10/09/2026',
    dataPagamento: '08/09/2026',
    status: 'PAID',
    locador: {
      nome: 'Hexx Participações e Administração de Bens Próprios S.A.',
      documento: '42.189.321/0001-85',
      endereco: 'Av. Brigadeiro Faria Lima, 3477, 14º andar — Itaim Bibi, São Paulo/SP',
      email: 'financeiro@hexxpatrimonial.com.br',
    },
    locatario: {
      nome: 'Studio Lumina Arquitetura e Engenharia Ltda',
      documento: '28.941.502/0001-70',
      endereco: 'Av. Paulista, 1000, Cj. 82 — Bela Vista, São Paulo/SP',
      email: 'contato@studiolumina.com.br',
    },
    imovel: {
      label: 'Conjunto Comercial 1402 — Edifício Platinum Corporate',
      endereco: 'Rua Amauri, 255, 14º andar, Itaim Bibi — São Paulo/SP — CEP 01448-000',
    },
    valores: {
      aluguel: 14500.0,
      condominio: 1850.0,
      iptu: 620.0,
      desconto: 500.0,
      total: 16470.0,
    },
    dadosPagamento: {
      forma: 'PIX (Chave CNPJ)',
      chavePix: '42.189.321/0001-85',
      banco: 'Banco Itaú BBA S.A. (Ag. 0931 / C/C 48102-9)',
    },
    codigoVerificacao: 'H7B49F',
    cidadeData: `São Paulo - SP, ${hojeBr}`,
  };
}

/**
 * Renderiza o PDF do recibo em Buffer pronto para download ou streaming.
 */
export function obterDadosReciboPagamentoExemplo(): ReciboAluguelData {
  const data = obterDadosReciboExemplo();
  return {
    ...data, tipo: 'PAGAMENTO', descricao: 'Assessoria empresarial — Setembro/2026', notaFiscal: '124',
    numeroRecibo: 'REC-202609-7B49F3', mesReferencia: 'Setembro/2026',
    dataVencimento: '10/09/2026', dataPagamento: '08/09/2026',
    locador: { ...data.locador, nome: 'Hexx Assessoria Empresarial Ltda.', email: 'financeiro@exemplo.com' },
    imovel: { label: 'Assessoria empresarial — Setembro/2026', endereco: '' },
    valores: { aluguel: 14500, total: 14500 }, dadosPagamento: undefined,
  };
}

export async function gerarPdfReciboAluguel(data: ReciboAluguelData): Promise<Buffer> {
  return renderReciboAluguelPdf(data);
}
