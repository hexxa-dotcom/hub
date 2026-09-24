import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * CLIENTES — quem compra da empresa, e tudo o que a empresa tem com cada um.
 *
 * O cliente é casado pelo DOCUMENTO (CPF/CNPJ, só dígitos) com:
 *   notas    — tomador das notas emitidas (Emissor Nacional) e as notas da Hexx;
 *   contratos — a outra parte dos contratos de entrada;
 *   a receber — as parcelas em aberto dessas notas e contratos.
 * Assim a ficha mostra a verdade mesmo para quem foi cadastrado à mão.
 */

const digitos = sql`regexp_replace(coalesce(c.document, ''), '[^0-9]', '', 'g')`;

export interface ClienteDaLista {
  id: string;
  nome: string;
  documento: string | null;
  tipo: 'PF' | 'PJ';
  email: string | null;
  telefone: string | null;
  faturado12m: number;
  aReceber: number;
  contratosAtivos: number;
  ultimaNota: string | null;
}

export async function listarClientes(ctx: TenantContext): Promise<ClienteDaLista[]> {
  const linhas = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      WITH cli AS (
        SELECT c.id, c.name, c.document, c.type, c.email, c.phone, ${digitos} AS doc
          FROM customer c WHERE c.company_id = ${ctx.companyId}
      ),
      notas AS (
        SELECT regexp_replace(tomador_documento, '[^0-9]', '', 'g') AS doc,
               sum(coalesce(valor_servico, valor_liquido)) FILTER (WHERE data_emissao >= now() - interval '12 months') AS total,
               max(data_emissao) AS ultima
          FROM nfse_distribuicao_doc
         WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND NOT cancelado
         GROUP BY 1
      ),
      contratos AS (
        SELECT regexp_replace(coalesce(party_cnpj, ''), '[^0-9]', '', 'g') AS doc, count(*) AS n
          FROM business_contract
         WHERE company_id = ${ctx.companyId} AND type = 'ENTRADA' AND status = 'ATIVO'
         GROUP BY 1
      ),
      receber AS (
        SELECT coalesce(
                 regexp_replace(ndd.tomador_documento, '[^0-9]', '', 'g'),
                 regexp_replace(coalesce(bc.party_cnpj, ''), '[^0-9]', '', 'g'),
                 regexp_replace(coalesce(cs.document, ''), '[^0-9]', '', 'g')
               ) AS doc,
               sum(fe.amount) AS total
          FROM financial_entry fe
          LEFT JOIN nfse_distribuicao_doc ndd ON fe.source = 'DFE_SYNC' AND ndd.company_id = fe.company_id AND ndd.chave_acesso = fe.external_id
          LEFT JOIN business_contract bc ON fe.source = 'CONTRACT' AND bc.id = fe.source_id
          LEFT JOIN service_invoice si ON fe.source = 'NFSE' AND si.id = fe.source_id
          LEFT JOIN customer cs ON cs.id = si.customer_id
         WHERE fe.company_id = ${ctx.companyId} AND fe.type = 'RECEIVABLE' AND fe.status IN ('PENDING', 'OVERDUE')
         GROUP BY 1
      )
      SELECT cli.id, cli.name, cli.document, cli.type, cli.email, cli.phone,
             coalesce(n.total, 0) AS faturado, coalesce(r.total, 0) AS receber, coalesce(k.n, 0) AS contratos, n.ultima
        FROM cli
        LEFT JOIN notas n ON n.doc = cli.doc AND cli.doc <> ''
        LEFT JOIN receber r ON r.doc = cli.doc AND cli.doc <> ''
        LEFT JOIN contratos k ON k.doc = cli.doc AND cli.doc <> ''
       ORDER BY coalesce(n.total, 0) DESC, cli.name
    `),
  )) as unknown as { id: string; name: string; document: string | null; type: string; email: string | null; phone: string | null; faturado: string; receber: string; contratos: string; ultima: string | null }[];

  return linhas.map((l) => ({
    id: l.id,
    nome: l.name,
    documento: l.document,
    tipo: (l.document?.replace(/\D/g, '').length === 11 ? 'PF' : l.type === 'PF' ? 'PF' : 'PJ') as 'PF' | 'PJ',
    email: l.email,
    telefone: l.phone,
    faturado12m: Number(l.faturado),
    aReceber: Number(l.receber),
    contratosAtivos: Number(l.contratos),
    ultimaNota: l.ultima ? new Date(l.ultima).toISOString() : null,
  }));
}

export interface FichaDoCliente {
  cliente: { id: string; nome: string; documento: string | null; tipo: string; email: string | null; telefone: string | null; endereco: string | null; desde: string };
  notas: { chave: string; numero: string | null; data: string | null; valor: number; descricao: string | null; cancelada: boolean }[];
  contratos: { id: string; titulo: string; valor: number; status: string; fim: string }[];
  aReceber: { id: string; descricao: string; valor: number; vencimento: string; atrasado: boolean }[];
  propostas: { id: string; numero: string; titulo: string; status: string; total: number; criadaEm: string }[];
  tarefas: { id: string; titulo: string; status: string; prazo: string | null }[];
}

export async function fichaDoCliente(ctx: TenantContext, id: string): Promise<FichaDoCliente | null> {
  return withTenant(ctx.companyId, async (tx) => {
    const [c] = (await tx.execute(sql`
      SELECT id, name, document, type, email, phone, address, created_at FROM customer WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}
    `)) as unknown as { id: string; name: string; document: string | null; type: string; email: string | null; phone: string | null; address: string | null; created_at: Date }[];
    if (!c) return null;
    const doc = (c.document ?? '').replace(/\D/g, '');
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const notas = doc
      ? ((await tx.execute(sql`
          SELECT chave_acesso, numero_nfse, data_emissao, coalesce(valor_servico, valor_liquido) AS valor, descricao_servico, cancelado
            FROM nfse_distribuicao_doc
           WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND direction = 'EMITIDA'
             AND regexp_replace(tomador_documento, '[^0-9]', '', 'g') = ${doc}
           ORDER BY data_emissao DESC LIMIT 50
        `)) as unknown as { chave_acesso: string; numero_nfse: string | null; data_emissao: string | null; valor: string; descricao_servico: string | null; cancelado: boolean }[])
      : [];

    const contratos = doc
      ? ((await tx.execute(sql`
          SELECT id, title, value, status, to_char(end_date, 'YYYY-MM-DD') AS fim FROM business_contract
           WHERE company_id = ${ctx.companyId} AND type = 'ENTRADA'
             AND regexp_replace(coalesce(party_cnpj, ''), '[^0-9]', '', 'g') = ${doc}
           ORDER BY created_at DESC
        `)) as unknown as { id: string; title: string; value: string; status: string; fim: string }[])
      : [];

    const receber = (await tx.execute(sql`
      SELECT fe.id, fe.description, fe.amount, to_char(fe.due_date, 'YYYY-MM-DD') AS venc
        FROM financial_entry fe
        LEFT JOIN nfse_distribuicao_doc ndd ON fe.source = 'DFE_SYNC' AND ndd.company_id = fe.company_id AND ndd.chave_acesso = fe.external_id
        LEFT JOIN business_contract bc ON fe.source = 'CONTRACT' AND bc.id = fe.source_id
        LEFT JOIN service_invoice si ON fe.source = 'NFSE' AND si.id = fe.source_id
       WHERE fe.company_id = ${ctx.companyId} AND fe.type = 'RECEIVABLE' AND fe.status IN ('PENDING', 'OVERDUE')
         AND (si.customer_id = ${id}::uuid
              OR (${doc} <> '' AND (regexp_replace(coalesce(ndd.tomador_documento, ''), '[^0-9]', '', 'g') = ${doc}
                                    OR regexp_replace(coalesce(bc.party_cnpj, ''), '[^0-9]', '', 'g') = ${doc})))
       ORDER BY fe.due_date LIMIT 50
    `)) as unknown as { id: string; description: string; amount: string; venc: string }[];

    const propostas = (await tx.execute(sql`
      SELECT p.id, p.numero, p.titulo, p.status, p.created_at,
             coalesce((SELECT sum(i.qtd * i.valor) FROM proposal_item i WHERE i.proposal_id = p.id), 0) AS total
        FROM proposal p WHERE p.company_id = ${ctx.companyId} AND p.customer_id = ${id}::uuid
       ORDER BY p.created_at DESC
    `)) as unknown as { id: string; numero: string; titulo: string; status: string; created_at: Date; total: string }[];

    const tarefas = (await tx.execute(sql`
      SELECT id, titulo, status, to_char(prazo, 'YYYY-MM-DD') AS prazo FROM crm_task
       WHERE company_id = ${ctx.companyId} AND customer_id = ${id}::uuid ORDER BY created_at DESC
    `)) as unknown as { id: string; titulo: string; status: string; prazo: string | null }[];

    return {
      cliente: {
        id: c.id,
        nome: c.name,
        documento: c.document,
        tipo: doc.length === 11 ? 'PF' : c.type,
        email: c.email,
        telefone: c.phone,
        endereco: c.address,
        desde: new Date(c.created_at).toISOString(),
      },
      notas: notas.map((n) => ({
        chave: n.chave_acesso,
        numero: n.numero_nfse,
        data: n.data_emissao ? new Date(n.data_emissao).toISOString() : null,
        valor: Number(n.valor),
        descricao: n.descricao_servico,
        cancelada: n.cancelado,
      })),
      contratos: contratos.map((k) => ({ id: k.id, titulo: k.title, valor: Number(k.value), status: k.status, fim: k.fim })),
      aReceber: receber.map((r) => ({ id: r.id, descricao: r.description, valor: Number(r.amount), vencimento: r.venc, atrasado: r.venc < hoje })),
      propostas: propostas.map((p) => ({ id: p.id, numero: p.numero, titulo: p.titulo, status: p.status, total: Number(p.total), criadaEm: new Date(p.created_at).toISOString() })),
      tarefas,
    };
  });
}
