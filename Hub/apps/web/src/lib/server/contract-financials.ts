import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import { financialEntry } from '@hexxa/db/schema';
import { diasDeVencimento } from '@hexxa/core/vencimentos';
import type { TenantContext } from '@hexxa/core';
import { impostoAluguel } from '@/app/(portal)/patrimonial/lib';
import { aliquotaDoFaturamento } from '@/lib/server/bussola';

/**
 * Geração de lançamentos financeiros (financial_entry) a partir de um
 * contrato (business_contract) ou de um aluguel (lease) — movida pra cá
 * (antes vivia local a cada actions.ts) porque agora também é chamada pelo
 * webhook de assinatura (api/webhooks/docuseal/route.ts): no fluxo do
 * wizard unificado, os lançamentos só nascem quando a assinatura eletrônica
 * é confirmada, não na criação do registro.
 */

/**
 * Meses que o contador já fechou (AAAA-MM-01). O banco recusa lançamento
 * neles — e um só recusado desfazia todos os outros do contrato.
 */
async function mesesFechados(companyId: string): Promise<Set<string>> {
  const rows = (await withTenant(companyId, (tx) =>
    tx.execute(sql`
      SELECT to_char(reference_month, 'YYYY-MM-DD') AS mes FROM monthly_closure
       WHERE company_id = ${companyId} AND stage IN ('FECHADO', 'CONFERIDO', 'ENVIADO')
    `),
  )) as unknown as { mes: string }[];
  return new Set(rows.map((r) => r.mes));
}

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

  // Uma parcela por mês, no dia de vencimento, de início a fim da vigência.
  // A primeira é a do primeiro dia de vencimento a partir do início — um
  // contrato que começa dia 24 com vencimento dia 10 paga a primeira em 10
  // do mês seguinte, não numa data anterior ao próprio contrato.
  const vencimentos = diasDeVencimento(startDate, endDate, dueDay);
  const months = vencimentos.length;
  const fechados = await mesesFechados(companyId);

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const dueDateStr = vencimentos[i]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';
      if (fechados.has(refMonth)) continue;

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
  // Vence todo mês no dia do início (dia 31 vira o último dia dos meses
  // curtos). Sem fim, 24 meses à frente.
  const [ay, am, ad] = startDate.split('-').map(Number) as [number, number, number];
  const limite = new Date(Date.UTC(ay, am - 1 + 24, ad - 1)).toISOString().slice(0, 10);
  const fim = endDate && endDate < limite ? endDate : limite;
  const vencimentos = diasDeVencimento(startDate, fim, ad).slice(0, 24);
  const months = vencimentos.length;
  // Meses já fechados pelo contador e os anteriores ao mês atual não entram:
  // são história, recebida por fora do Hub antes do cadastro.
  const fechados = await mesesFechados(companyId);
  const mesAtual = `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)}-01`;

  // Imposto previsto sobre o aluguel, pela alíquota do regime da empresa (a
  // mesma da Bússola), provisionado no mesmo mês da receita. Sem alíquota
  // conhecida, não provisiona — melhor nada do que um número inventado.
  const ctx = { companyId, companyType: 'SERVICE', userId: 'sistema' } as TenantContext;
  const aliquota = await aliquotaDoFaturamento(ctx).then((t) => t.aliquota).catch(() => 0);
  const impostoMensal = Math.round(impostoAluguel(valor, aliquota) * 100) / 100;

  await withTenant(companyId, async (tx) => {
    for (let i = 0; i < months; i++) {
      const dueDateStr = vencimentos[i]!;
      const refMonth = dueDateStr.substring(0, 8) + '01';
      if (refMonth < mesAtual || fechados.has(refMonth)) continue;
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
