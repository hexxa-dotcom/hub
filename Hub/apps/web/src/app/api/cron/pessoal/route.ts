import { NextResponse } from 'next/server';
import { getDb, withDbTimeout, sql } from '@hexxa/db';
import { proLaboreDoMes, custoDoColaborador } from '@hexxa/core/folha';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * PRÓ-LABORE E SALÁRIOS DO MÊS — no financeiro sozinhos.
 *
 * Roda todo dia (idempotente: não duplica o mês) e garante, para o mês
 * corrente:
 *   · o pró-labore LÍQUIDO de cada sócio (vence dia 5). O INSS e o IRRF
 *     retidos saem na guia que a contabilidade envia — lançar o bruto
 *     contaria duas vezes;
 *   · a previsão do salário líquido de cada CLT/estagiário ativo (vence dia
 *     5). A folha oficial e o holerite vêm da contabilidade.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const ref = `${hoje.slice(0, 7)}-01`;
  const vence = `${hoje.slice(0, 7)}-05`;
  const mes = hoje.slice(0, 7).split('-').reverse().join('/');
  // Mês já vencido não é lançado: na primeira vez que roda (ou para quem
  // chegou depois do dia 5) começa no mês seguinte, sem nascer atrasado.
  if (hoje > vence) return NextResponse.json({ ok: true, lancados: 0, erros: [], motivo: 'mês já vencido' });

  const socios = (await withDbTimeout(
    db.execute(sql`
      SELECT p.id, p.company_id, p.name, p.pro_labore FROM partner p
        JOIN company c ON c.id = p.company_id
       WHERE p.pro_labore > 0 AND c.closed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM financial_entry f WHERE f.source = 'PROLABORE' AND f.source_id = p.id AND f.reference_month = ${ref}::date)
    `),
    15000,
  )) as unknown as { id: string; company_id: string; name: string; pro_labore: string }[];

  const equipe = (await withDbTimeout(
    db.execute(sql`
      SELECT e.id, e.company_id, e.name, e.salary FROM employee e
        JOIN company c ON c.id = e.company_id
       WHERE e.status = 'ACTIVE' AND e.vinculo IN ('CLT', 'Estagiario') AND e.salary > 0 AND c.closed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM financial_entry f WHERE f.source = 'PAYROLL' AND f.source_id = e.id AND f.reference_month = ${ref}::date)
    `),
    15000,
  )) as unknown as { id: string; company_id: string; name: string; salary: string }[];

  let lancados = 0;
  const erros: string[] = [];
  for (const s of socios) {
    try {
      const p = proLaboreDoMes(Number(s.pro_labore));
      await db.execute(sql`
        INSERT INTO financial_entry (company_id, type, status, description, amount, due_date, reference_month, source, source_id)
        VALUES (${s.company_id}, 'PAYABLE', 'PENDING', ${`Pró-labore líquido — ${s.name} (${mes})`}, ${p.liquido}, ${vence}, ${ref}, 'PROLABORE', ${s.id})
      `);
      lancados++;
    } catch (err) {
      erros.push(`sócio ${s.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  for (const e of equipe) {
    try {
      const c = custoDoColaborador(Number(e.salary));
      await db.execute(sql`
        INSERT INTO financial_entry (company_id, type, status, description, amount, due_date, reference_month, source, source_id)
        VALUES (${e.company_id}, 'PAYABLE', 'PENDING', ${`Salário líquido (previsão) — ${e.name} (${mes})`}, ${c.liquido}, ${vence}, ${ref}, 'PAYROLL', ${e.id})
      `);
      lancados++;
    } catch (err) {
      erros.push(`colaborador ${e.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return NextResponse.json({ ok: erros.length === 0, lancados, erros });
}
