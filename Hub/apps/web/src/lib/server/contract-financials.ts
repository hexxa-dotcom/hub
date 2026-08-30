import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import { financialEntry } from '@hexxa/db/schema';
import { impostoAluguel } from '@/app/(portal)/patrimonial/lib';

/**
 * Geração de lançamentos financeiros (financial_entry) a partir de um
 * contrato (business_contract) ou de um aluguel (lease) — movida pra cá
 * (antes vivia local a cada actions.ts) porque agora também é chamada pelo
 * webhook de assinatura (api/webhooks/docuseal/route.ts): no fluxo do
 * wizard unificado, os lançamentos só nascem quando a assinatura eletrônica
 * é confirmada, não na criação do registro.
 */

/** Gera os lançamentos financeiros mensais de um contrato (business_contract) para UMA empresa. */
export async function gerarLancamentosDoContrato(params: {
  companyId: string;
  contractId: string;
  tipo: 'PAGAR' | 'RECEBER';
  descricao: string;
  valor: number;
  dueDay: number;
  startDate: string;
  endDate: string;
}) {
  const { companyId, contractId, tipo, descricao, valor, dueDay, startDate, endDate } = params;
  const typeStr = tipo === 'PAGAR' ? 'PAYABLE' : 'RECEIVABLE';

  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const months = Math.max(
    1,
    Math.min(60, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1),
  );

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      due.setDate(Math.min(dueDay, 28));
      const dueDateStr = due.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';

      await tx.insert(financialEntry).values({
        companyId,
        type: typeStr,
        description: months > 1 ? `${descricao} (${i + 1}/${months})` : descricao,
        amount: String(valor),
        dueDate: dueDateStr,
        referenceMonth: refMonth,
        status: 'PENDING',
        source: 'CONTRACT',
        sourceId: contractId,
      });
    }
  });
}

/** Já existe algum lançamento gerado pra este contrato? (idempotência — webhook do provider de assinatura pode reentregar o mesmo evento). */
export async function jaTemLancamentosDoContrato(companyId: string, contractId: string): Promise<boolean> {
  const rows = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      SELECT 1 FROM financial_entry WHERE company_id = ${companyId} AND source = 'CONTRACT' AND source_id = ${contractId} LIMIT 1
    `);
  });
  return rows.length > 0;
}

/** Gera até 24 meses de lançamentos (financial_entry, RECEIVABLE + provisão de imposto) a partir da vigência do aluguel. */
export async function gerarLancamentosDoAluguel(params: {
  companyId: string;
  leaseId: string;
  descricao: string;
  valor: number;
  startDate: string;
  endDate: string | null;
}) {
  const { companyId, leaseId, descricao, valor, startDate, endDate } = params;
  const start = new Date(startDate + 'T12:00:00');
  const end = endDate ? new Date(endDate + 'T12:00:00') : new Date(start.getFullYear() + 2, start.getMonth(), start.getDate());
  const months = Math.max(
    1,
    Math.min(24, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1),
  );

  // Imposto mensal estimado (Lucro Presumido) sobre o aluguel — provisionado
  // junto com a receita, no mesmo período, pra não superestimar o lucro
  // distribuível (mesmo padrão já usado na emissão de NFSe: ver
  // service-invoice.service.ts, "Provisão de Imposto - NFSe").
  const impostoMensal = impostoAluguel(valor * 12) / 12;

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      const dueDateStr = due.toISOString().split('T')[0]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';
      const suffix = months > 1 ? ` (${i + 1}/${months})` : '';
      await tx.execute(sql`
        INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, source_id)
        VALUES (${companyId}, 'RECEIVABLE', ${`${descricao}${suffix}`}, ${valor}, ${dueDateStr}, ${refMonth}, 'PENDING', 'RENT', ${leaseId})
      `);
      if (impostoMensal > 0) {
        await tx.execute(sql`
          INSERT INTO financial_entry (company_id, type, description, amount, due_date, reference_month, status, source, source_id)
          VALUES (${companyId}, 'PAYABLE', ${`Provisão de Imposto - Aluguel${suffix}`}, ${impostoMensal}, ${dueDateStr}, ${refMonth}, 'PENDING', 'RENT', ${leaseId})
        `);
      }
    }
  });
}

/** Já existe algum lançamento gerado pra este aluguel? (mesma idempotência do contrato). */
export async function jaTemLancamentosDoAluguel(companyId: string, leaseId: string): Promise<boolean> {
  const rows = await withTenant(companyId, async (tx) => {
    return tx.execute(sql`
      SELECT 1 FROM financial_entry WHERE company_id = ${companyId} AND source = 'RENT' AND source_id = ${leaseId} LIMIT 1
    `);
  });
  return rows.length > 0;
}
