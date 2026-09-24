import 'server-only';
import { randomBytes } from 'node:crypto';
import { getDb, withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * PROPOSTAS — do orçamento ao contrato.
 *
 * Rascunho → enviada (gera o link /p/<token>) → vista (o cliente abriu) →
 * aceita ou recusada (o cliente decide no link, com nome e e-mail
 * registrados) — e, aceita, vira contrato com um clique. Expirada é
 * calculada: passou da validade sem decisão.
 *
 * O status 'aprovada' é o "aceita" (nome antigo mantido no banco).
 */

export type StatusDaProposta = 'rascunho' | 'enviada' | 'vista' | 'aprovada' | 'rejeitada' | 'expirada';

export interface ItemDaProposta {
  descricao: string;
  qtd: number;
  valor: number;
}

export interface Proposta {
  id: string;
  numero: string;
  titulo: string;
  cliente: { id: string | null; nome: string; documento: string | null; email: string | null };
  itens: ItemDaProposta[];
  total: number;
  recorrencia: 'MENSAL' | 'UNICA';
  prazoMeses: number | null;
  validade: string;
  observacoes: string | null;
  status: StatusDaProposta;
  link: string | null;
  enviadaEm: string | null;
  vistaEm: string | null;
  decisao: { em: string; nome: string | null; email: string | null; nota: string | null } | null;
  contratoId: string | null;
  criadaEm: string;
}

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

type Linha = {
  id: string;
  numero: string;
  titulo: string;
  cliente: string;
  customer_id: string | null;
  cli_nome: string | null;
  cli_doc: string | null;
  cli_email: string | null;
  validade: string;
  status: string;
  observacoes: string | null;
  recorrencia: string;
  prazo_meses: number | null;
  public_token: string | null;
  sent_at: Date | null;
  viewed_at: Date | null;
  decided_at: Date | null;
  decided_by_name: string | null;
  decided_by_email: string | null;
  decision_note: string | null;
  contract_id: string | null;
  created_at: Date;
  itens: { descricao: string; qtd: string; valor: string }[] | null;
};

const SELECT = sql`
  SELECT p.id, p.numero, p.titulo, p.cliente, p.customer_id, c.name AS cli_nome, c.document AS cli_doc, c.email AS cli_email,
         to_char(p.validade, 'YYYY-MM-DD') AS validade, p.status, p.observacoes, p.recorrencia, p.prazo_meses, p.public_token,
         p.sent_at, p.viewed_at, p.decided_at, p.decided_by_name, p.decided_by_email, p.decision_note, p.contract_id, p.created_at,
         (SELECT json_agg(json_build_object('descricao', i.descricao, 'qtd', i.qtd, 'valor', i.valor) ORDER BY i.id)
            FROM proposal_item i WHERE i.proposal_id = p.id) AS itens
    FROM proposal p
    LEFT JOIN customer c ON c.id = p.customer_id
`;

function montar(l: Linha, origem: string): Proposta {
  const itens = (l.itens ?? []).map((i) => ({ descricao: i.descricao, qtd: Number(i.qtd), valor: Number(i.valor) }));
  const decidida = l.status === 'aprovada' || l.status === 'rejeitada';
  const status = (!decidida && l.status !== 'rascunho' && l.validade < hoje() ? 'expirada' : l.status) as StatusDaProposta;
  return {
    id: l.id,
    numero: l.numero,
    titulo: l.titulo,
    cliente: { id: l.customer_id, nome: l.cli_nome ?? l.cliente, documento: l.cli_doc, email: l.cli_email },
    itens,
    total: itens.reduce((s, i) => s + i.qtd * i.valor, 0),
    recorrencia: l.recorrencia === 'UNICA' ? 'UNICA' : 'MENSAL',
    prazoMeses: l.prazo_meses,
    validade: l.validade,
    observacoes: l.observacoes,
    status,
    link: l.public_token ? `${origem}/p/${l.public_token}` : null,
    enviadaEm: l.sent_at ? new Date(l.sent_at).toISOString() : null,
    vistaEm: l.viewed_at ? new Date(l.viewed_at).toISOString() : null,
    decisao: l.decided_at
      ? { em: new Date(l.decided_at).toISOString(), nome: l.decided_by_name, email: l.decided_by_email, nota: l.decision_note }
      : null,
    contratoId: l.contract_id,
    criadaEm: new Date(l.created_at).toISOString(),
  };
}

export async function listarPropostas(ctx: TenantContext, origem: string): Promise<Proposta[]> {
  const linhas = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`${SELECT} WHERE p.company_id = ${ctx.companyId} ORDER BY p.created_at DESC`),
  )) as unknown as Linha[];
  return linhas.map((l) => montar(l, origem));
}

export async function propostaDaEmpresa(ctx: TenantContext, id: string, origem: string): Promise<Proposta | null> {
  const [l] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`${SELECT} WHERE p.company_id = ${ctx.companyId} AND p.id = ${id}::uuid`),
  )) as unknown as Linha[];
  return l ? montar(l, origem) : null;
}

/** Próximo número da empresa: PROP-2026-001. */
export async function proximoNumero(ctx: TenantContext): Promise<string> {
  const ano = hoje().slice(0, 4);
  const [r] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`SELECT count(*)::int AS n FROM proposal WHERE company_id = ${ctx.companyId} AND numero LIKE ${`PROP-${ano}-%`}`),
  )) as unknown as { n: number }[];
  return `PROP-${ano}-${String((r?.n ?? 0) + 1).padStart(3, '0')}`;
}

export const novoToken = () => randomBytes(18).toString('base64url');

/** A proposta pelo link público — só o que o cliente precisa ver, e a empresa que a enviou. */
export async function propostaPublica(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const db = getDb();
  const [l] = (await db.execute(sql`${SELECT} WHERE p.public_token = ${token}`)) as unknown as (Linha & { company_id?: string })[];
  if (!l) return null;
  const [dono] = (await db.execute(sql`
    SELECT c.id, coalesce(nullif(trim(c.trade_name), ''), c.legal_name) AS nome, c.legal_name, c.cnpj, c.logo_url, c.email, c.phone, c.whatsapp, c.city, c.state
      FROM proposal p JOIN company c ON c.id = p.company_id WHERE p.public_token = ${token}
  `)) as unknown as { id: string; nome: string; legal_name: string; cnpj: string; logo_url: string | null; email: string | null; phone: string | null; whatsapp: string | null; city: string | null; state: string | null }[];
  return { proposta: montar(l, ''), empresa: dono! };
}

/** O cliente abriu o link: marca "vista" (só a primeira vez). */
export async function registrarVisualizacao(token: string) {
  const db = getDb();
  const [p] = (await db.execute(sql`
    UPDATE proposal SET viewed_at = now(), status = CASE WHEN status = 'enviada' THEN 'vista' ELSE status END
     WHERE public_token = ${token} AND viewed_at IS NULL
     RETURNING company_id, numero, titulo
  `)) as unknown as { company_id: string; numero: string; titulo: string }[];
  if (p) {
    await db.execute(sql`
      INSERT INTO notification (company_id, title, body, severity)
      VALUES (${p.company_id}, 'Proposta vista', ${`O cliente abriu a proposta ${p.numero} — "${p.titulo}".`}, 'INFO')
    `);
  }
}

/** O cliente aceita ou recusa no link. Só decide uma vez, e só dentro da validade. */
export async function decidirProposta(
  token: string,
  decisao: { aceitar: boolean; nome: string; email: string; nota: string },
  ip: string | null,
): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const [p] = (await db.execute(sql`
    SELECT id, company_id, numero, titulo, status, to_char(validade, 'YYYY-MM-DD') AS validade FROM proposal WHERE public_token = ${token}
  `)) as unknown as { id: string; company_id: string; numero: string; titulo: string; status: string; validade: string }[];
  if (!p) return { ok: false, message: 'Proposta não encontrada.' };
  if (p.status === 'aprovada' || p.status === 'rejeitada') return { ok: false, message: 'Esta proposta já foi respondida.' };
  if (p.validade < hoje()) return { ok: false, message: 'Esta proposta expirou. Peça uma nova a quem enviou.' };
  if (!decisao.nome.trim() || !/.+@.+\..+/.test(decisao.email)) return { ok: false, message: 'Informe seu nome e e-mail.' };

  await db.execute(sql`
    UPDATE proposal
       SET status = ${decisao.aceitar ? 'aprovada' : 'rejeitada'}, decided_at = now(),
           decided_by_name = ${decisao.nome.trim()}, decided_by_email = ${decisao.email.trim()},
           decided_ip = ${ip}, decision_note = ${decisao.nota.trim() || null}
     WHERE id = ${p.id}::uuid
  `);
  await db.execute(sql`
    INSERT INTO notification (company_id, title, body, severity)
    VALUES (${p.company_id}, ${decisao.aceitar ? 'Proposta aceita' : 'Proposta recusada'},
            ${`${decisao.nome.trim()} ${decisao.aceitar ? 'aceitou' : 'recusou'} a proposta ${p.numero} — "${p.titulo}".${decisao.aceitar ? ' Transforme em contrato em Propostas.' : ''}`},
            ${decisao.aceitar ? 'INFO' : 'WARNING'})
  `);
  return { ok: true, message: decisao.aceitar ? 'Proposta aceita. Quem enviou já foi avisado.' : 'Resposta registrada. Obrigado.' };
}
