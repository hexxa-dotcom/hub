'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, sql } from '@hexxa/db';
import { valorDosHonorarios } from '@hexxa/core';

/**
 * PLANO — o que a empresa contratou da contabilidade e as faturas de
 * honorários. As faturas são as que o contador gera todo mês
 * (accounting_invoice, cron de honorários) — antes a tela buscava um
 * histórico no Asaas que nenhuma empresa tem, e o "Pagar via Pix" criava uma
 * cobrança no Asaas DA PRÓPRIA EMPRESA, contra ela mesma.
 */

export type PlanoAtual = {
  nome: string;
  descricao: string | null;
  recursos: string[];
  valorDaTabela: number;
  valor: number;
  comoChegou: string | null;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  desde: string | null;
} | null;

export type Fatura = {
  id: string;
  descricao: string;
  valor: number;
  referencia: string;
  vencimento: string;
  situacao: 'ABERTA' | 'ATRASADA' | 'PAGA';
  pix: string | null;
};

export async function getPlanoAtualAction(): Promise<PlanoAtual> {
  const ctx = await getTenantContext();
  const [r] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT p.name, p.monthly_value, p.features, s.status, s.discount_value, s.discount_reason, s.custom_value,
             to_char(s.current_period_start, 'YYYY-MM-DD') AS desde
        FROM subscription s JOIN plan p ON p.id = s.plan_id
       WHERE s.company_id = ${ctx.companyId}
       ORDER BY (s.status = 'ACTIVE') DESC
       LIMIT 1
    `),
  )) as unknown as {
    name: string; monthly_value: string; features: Record<string, unknown> | null; status: NonNullable<PlanoAtual>['status'];
    discount_value: string; discount_reason: string | null; custom_value: string | null; desde: string | null;
  }[];
  if (!r) return null;
  const f = r.features ?? {};
  const tabela = Number(r.monthly_value);
  const valor = valorDosHonorarios({ valorDoPlano: tabela, desconto: r.discount_value, valorCombinado: r.custom_value });
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const comoChegou =
    r.custom_value != null
      ? 'Valor combinado com a contabilidade'
      : Number(r.discount_value) > 0
        ? `${brl(tabela)} com desconto de ${brl(Number(r.discount_value))}${r.discount_reason ? ` — ${r.discount_reason}` : ''}`
        : null;
  return {
    nome: (typeof f.nomeComercial === 'string' && f.nomeComercial) || r.name,
    descricao: typeof f.descricao === 'string' ? f.descricao : null,
    recursos: Array.isArray(f.recursos) ? (f.recursos as string[]) : [],
    valorDaTabela: tabela,
    valor,
    comoChegou,
    status: r.status,
    desde: r.desde,
  };
}

export async function listarFaturasAction(): Promise<Fatura[]> {
  const ctx = await getTenantContext();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const rows = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT id, description, value, to_char(reference_month, 'YYYY-MM-DD') AS ref, to_char(due_date, 'YYYY-MM-DD') AS venc, status, pix_code
        FROM accounting_invoice WHERE company_id = ${ctx.companyId}
       ORDER BY reference_month DESC LIMIT 24
    `),
  )) as unknown as { id: string; description: string; value: string; ref: string; venc: string; status: string; pix_code: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    descricao: r.description,
    valor: Number(r.value),
    referencia: r.ref,
    vencimento: r.venc,
    situacao: r.status === 'PAID' ? 'PAGA' : r.status === 'OVERDUE' || r.venc < hoje ? 'ATRASADA' : 'ABERTA',
    pix: r.pix_code,
  }));
}
