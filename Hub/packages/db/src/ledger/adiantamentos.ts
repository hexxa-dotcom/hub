import { sql } from 'drizzle-orm';
import { ACCOUNTS } from '@hexxa/core';
import type { DbHandle } from '../client';
import { postJournal } from './repository';
import { cnpjNoHistorico } from './parceiro';

/**
 * ADIANTAMENTO DE CLIENTES — o dinheiro que entrou sem nota.
 *
 * O extrato lança o recebimento sem nota em Adiantamento de Clientes
 * (`contaDaEntrada`). Aqui o saldo é acompanhado por cliente (CNPJ do
 * histórico do Pix) e compensado quando a nota daquele cliente sai: a nota
 * vira receita pelo caminho normal e o adiantamento baixa contra Clientes.
 *
 * Nada é baixado para o resultado sozinho. O que sobrar parado fica na lista
 * do contador (`adiantamentosDeClientes`), com a idade, para ele decidir:
 * emitir a nota agora, devolver, ou baixar no encerramento do exercício.
 */

export interface AdiantamentoDoCliente {
  cnpj: string;
  nome: string;
  saldo: number;
  /** Data do recebimento mais antigo ainda não compensado. */
  desde: string;
  dias: number;
}

/** Movimentos em Adiantamento de Clientes, com o CNPJ de cada um. */
async function movimentosDeAdiantamento(tx: DbHandle, companyId: string) {
  return (await tx.execute(sql`
    SELECT to_char(j.entry_date, 'YYYY-MM-DD') AS data,
           CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE -l.amount END::float AS valor,
           bp.document AS doc, bp.name AS nome, bt.description AS historico
      FROM ledger_line l
      JOIN journal_entry j ON j.id = l.journal_entry_id
      JOIN chart_of_account a ON a.id = l.account_id
      LEFT JOIN business_partner bp ON bp.id = l.partner_id
      LEFT JOIN bank_transaction bt ON j.source = 'BANK_TRANSACTION' AND bt.id = j.source_id
     WHERE l.company_id = ${companyId} AND j.status = 'POSTED'
       AND a.code = ${ACCOUNTS.ADIANTAMENTO_CLIENTE}
     ORDER BY j.entry_date
  `)) as unknown as { data: string; valor: number; doc: string | null; nome: string | null; historico: string | null }[];
}

/** Saldo de adiantamento por cliente (só os que têm saldo). */
export async function adiantamentosDeClientes(tx: DbHandle, companyId: string): Promise<AdiantamentoDoCliente[]> {
  const porCnpj = new Map<string, { nome: string; saldo: number; entradas: { data: string; valor: number }[] }>();
  for (const m of await movimentosDeAdiantamento(tx, companyId)) {
    const cnpj = (m.doc ?? '').replace(/\D/g, '') || (m.historico ? cnpjNoHistorico(m.historico) : null) || 'SEM_CNPJ';
    const nome = m.nome ?? (m.historico ? m.historico.split(' - ')[1]?.trim() : null) ?? 'Sem identificação';
    const c = porCnpj.get(cnpj) ?? { nome, saldo: 0, entradas: [] };
    c.saldo = Math.round((c.saldo + m.valor) * 100) / 100;
    if (m.valor > 0) c.entradas.push({ data: m.data, valor: m.valor });
    porCnpj.set(cnpj, c);
  }
  const hoje = new Date();
  const out: AdiantamentoDoCliente[] = [];
  for (const [cnpj, c] of porCnpj) {
    if (c.saldo < 0.01) continue;
    // Compensação é FIFO (a nota baixa o mais antigo), então o saldo que resta
    // são os recebimentos mais NOVOS; a idade é a do mais antigo entre eles.
    let resto = c.saldo;
    let desde = c.entradas[c.entradas.length - 1]?.data ?? '';
    for (let i = c.entradas.length - 1; i >= 0 && resto > 0.005; i--) {
      desde = c.entradas[i]!.data;
      resto -= c.entradas[i]!.valor;
    }
    const dias = desde ? Math.floor((hoje.getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86_400_000) : 0;
    out.push({ cnpj, nome: c.nome, saldo: c.saldo, desde, dias });
  }
  return out.sort((a, b) => b.dias - a.dias);
}

/**
 * Compensa adiantamento com nota: para cada nota em aberto de um cliente que
 * tem adiantamento que a cobre, baixa a nota contra o adiantamento
 * (D Adiantamento de Clientes / C Clientes). Devolve quantas notas baixou.
 */
export async function compensarAdiantamentos(tx: DbHandle, companyId: string): Promise<number> {
  const saldos = new Map((await adiantamentosDeClientes(tx, companyId)).map((a) => [a.cnpj, a.saldo]));
  if (!saldos.size) return 0;
  const notas = (await tx.execute(sql`
    SELECT e.id::text, e.amount::float AS valor, to_char(e.due_date, 'YYYY-MM-DD') AS data, e.description,
           e.partner_id::text AS parceiro, regexp_replace(coalesce(bp.document, ''), '[^0-9]', '', 'g') AS cnpj
      FROM financial_entry e JOIN business_partner bp ON bp.id = e.partner_id
     WHERE e.company_id = ${companyId} AND e.type = 'RECEIVABLE' AND e.status IN ('PENDING', 'OVERDUE')
       AND e.source IN ('NFSE', 'DFE_SYNC')
     ORDER BY e.due_date
  `)) as unknown as { id: string; valor: number; data: string; description: string; parceiro: string; cnpj: string }[];
  let baixadas = 0;
  for (const n of notas) {
    const saldo = saldos.get(n.cnpj) ?? 0;
    if (saldo + 0.005 < n.valor) continue;
    await postJournal(tx, companyId, {
      entryDate: n.data,
      referenceMonth: `${n.data.slice(0, 7)}-01`,
      memo: `Compensação de adiantamento — ${n.description}`,
      source: 'FINANCIAL_ENTRY',
      sourceId: n.id,
      event: 'SETTLEMENT',
      lines: [
        { accountCode: ACCOUNTS.ADIANTAMENTO_CLIENTE, direction: 'DEBIT', amount: n.valor, partnerId: n.parceiro },
        { accountCode: ACCOUNTS.CLIENTES, direction: 'CREDIT', amount: n.valor, partnerId: n.parceiro },
      ],
    });
    await tx.execute(sql`UPDATE financial_entry SET status = 'PAID', paid_at = ${n.data}::date WHERE id = ${n.id}`);
    saldos.set(n.cnpj, Math.round((saldo - n.valor) * 100) / 100);
    baixadas++;
  }
  return baixadas;
}
