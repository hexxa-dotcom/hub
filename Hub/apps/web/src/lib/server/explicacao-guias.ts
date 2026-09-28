import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * DE ONDE VEIO ESTA GUIA — a explicação que aparece ao abrir a guia.
 *
 * Com os números da própria empresa, não texto genérico: o DAS diz quanto
 * foi faturado em notas no mês e a alíquota efetiva que o OneFlow aplicou;
 * a DCTFWeb diz sobre qual folha/pró-labore foram os descontos. A conta só
 * aparece quando fecha com o valor da guia — se não fecha, mostra os fatos
 * sem forçar uma multiplicação que não é a verdadeira.
 */

export interface ExplicacaoDaGuia {
  resumo: string;
  /** Linhas "rótulo: valor" para compor a conta. */
  linhas: { rotulo: string; valor: string }[];
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const periodo = (mes: string) => {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return `de 01/${mm} a ${ultimo}/${mm}/${a}`;
};

export async function explicarGuias(
  ctx: TenantContext,
  guias: { id: string; taxName: string; referenceMonth: string; amount: number }[],
): Promise<Record<string, ExplicacaoDaGuia>> {
  const meses = Array.from(new Set(guias.map((g) => g.referenceMonth.slice(0, 7))));
  if (!meses.length) return {};

  const [notas, apurada, historico, folha] = await withTenant(ctx.companyId, async (tx) =>
    Promise.all([
      tx.execute(sql`
        SELECT to_char(data_emissao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes,
               sum(coalesce(valor_servico, valor_liquido, 0))::float AS total, count(*)::int AS qtd
          FROM nfse_distribuicao_doc
         WHERE company_id = ${ctx.companyId} AND tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND NOT cancelado
         GROUP BY 1`),
      tx.execute(sql`SELECT competencia AS mes, receita::float AS receita FROM receita_apurada WHERE company_id = ${ctx.companyId}`),
      tx.execute(sql`SELECT reference_month AS mes, effective_rate::float AS aliquota, tax_bracket AS faixa, source FROM tax_history WHERE company_id = ${ctx.companyId}`),
      tx.execute(sql`
        SELECT to_char(j.reference_month, 'YYYY-MM') AS mes, j.memo ILIKE '13%' AS decimo,
               coalesce(sum(l.amount) FILTER (WHERE l.direction = 'DEBIT'), 0)::float AS bruto,
               coalesce(sum(l.amount) FILTER (WHERE l.direction = 'CREDIT' AND a.code = '2.1.02.002'), 0)::float AS inss,
               coalesce(sum(l.amount) FILTER (WHERE l.direction = 'CREDIT' AND a.code = '2.1.03.001'), 0)::float AS irrf
          FROM journal_entry j
          JOIN ledger_line l ON l.journal_entry_id = j.id
          JOIN chart_of_account a ON a.id = l.account_id
         WHERE j.company_id = ${ctx.companyId} AND j.source = 'PAYSLIP' AND j.event = 'ACCRUAL' AND j.reversed_by IS NULL
         GROUP BY 1, 2`),
    ]),
  ) as unknown as [
    { mes: string; total: number; qtd: number }[],
    { mes: string; receita: number }[],
    { mes: string; aliquota: number; faixa: string; source: string }[],
    { mes: string; decimo: boolean; bruto: number; inss: number; irrf: number }[],
  ];

  const out: Record<string, ExplicacaoDaGuia> = {};
  for (const g of guias) {
    const mes = g.referenceMonth.slice(0, 7);
    const nomeMes = `${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`;
    const n = g.taxName.toUpperCase();

    if (/DAS|SIMPLES/.test(n)) {
      const nf = notas.find((x) => x.mes === mes);
      const receita = apurada.find((x) => x.mes === mes)?.receita ?? nf?.total ?? null;
      const h = historico.find((x) => x.mes === mes);
      const linhas: ExplicacaoDaGuia['linhas'] = [];
      if (receita !== null) linhas.push({ rotulo: 'Faturamento do mês', valor: `${BRL(receita)}${nf ? ` em ${nf.qtd} ${nf.qtd === 1 ? 'nota' : 'notas'}` : ''}` });
      if (h) linhas.push({ rotulo: 'Alíquota efetiva', valor: `${pct(h.aliquota)}${h.faixa ? ` · ${h.faixa}` : ''}` });
      // A conta só aparece quando fecha com a guia (tolerância de 1%).
      const fecha = receita && h && Math.abs((receita * h.aliquota) / 100 - g.amount) <= Math.max(1, g.amount * 0.01);
      if (fecha) linhas.push({ rotulo: 'Conta', valor: `${BRL(receita!)} × ${pct(h!.aliquota)} = ${BRL(g.amount)}` });
      out[g.id] = {
        resumo: `Imposto único do Simples Nacional sobre as notas fiscais emitidas ${periodo(mes)}. Nele já estão IRPJ, CSLL, PIS, COFINS, ISS e a contribuição previdenciária da empresa.`,
        linhas,
      };
      continue;
    }

    if (/DCTF\s*WEB|INSS/.test(n)) {
      const decimo = /13/.test(n);
      const f = folha.find((x) => x.mes === mes && x.decimo === decimo);
      const linhas: ExplicacaoDaGuia['linhas'] = [];
      if (f) {
        linhas.push({ rotulo: decimo ? 'Folha do 13º' : 'Folha e pró-labore do mês', valor: BRL(f.bruto) });
        if (f.inss > 0) linhas.push({ rotulo: 'INSS descontado', valor: BRL(f.inss) });
        if (f.irrf > 0) linhas.push({ rotulo: 'IRRF descontado', valor: BRL(f.irrf) });
        const patronal = Math.round((g.amount - f.inss - f.irrf) * 100) / 100;
        if (patronal > 0.01) linhas.push({ rotulo: 'Parte da empresa (patronal)', valor: BRL(patronal) });
      }
      out[g.id] = {
        resumo: `INSS${f?.irrf ? ' e Imposto de Renda' : ''} descontados ${decimo ? 'do 13º' : `da folha e do pró-labore de ${nomeMes}`}, declarados na DCTFWeb. O valor já saiu do pagamento de quem recebeu — a empresa só repassa ao governo.`,
        linhas,
      };
      continue;
    }

    if (/FGTS/.test(n)) {
      out[g.id] = {
        resumo: /RESCIS/.test(n)
          ? `FGTS da rescisão de contrato em ${nomeMes}: o depósito do mês e a multa, quando houver.`
          : `FGTS de ${nomeMes}: 8% sobre os salários dos funcionários, depositado na conta do FGTS de cada um. Pró-labore de sócio não tem FGTS.`,
        linhas: [],
      };
      continue;
    }

    if (/ISS/.test(n)) out[g.id] = { resumo: `ISS de ${nomeMes}: imposto municipal sobre os serviços prestados.`, linhas: [] };
    else if (/PARCEL/.test(n)) out[g.id] = { resumo: 'Parcela de um parcelamento de débitos em aberto com o governo.', linhas: [] };
  }
  return out;
}
