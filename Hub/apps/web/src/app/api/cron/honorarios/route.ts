import { NextResponse } from 'next/server';
import { getDb, withDbTimeout, eq, and, sql } from '@hexxa/db';
import { isNull } from 'drizzle-orm';
import { accountingInvoice, subscription, plan, company } from '@hexxa/db/schema';
import { valorDosHonorarios, descricaoDosHonorarios } from '@hexxa/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** O nome do plano como o cliente o conhece, quando houver um. */
function nomeComercial(features: unknown): string | null {
  const f = features as { nomeComercial?: unknown } | null;
  const nome = typeof f?.nomeComercial === 'string' ? f.nomeComercial.trim() : '';
  return nome || null;
}

/**
 * FATURA MENSAL DE HONORÁRIOS.
 *
 * ── Por que é uma rota separada ─────────────────────────────────────────
 *
 * Isto vivia dentro de `/api/cron/fechamento`, misturado com o fechamento
 * contábil. São coisas sem relação: faturar o cliente pelo serviço da Hexxa é
 * cobrança da plataforma, e encerrar um período é contabilidade. Estavam
 * juntas só porque as duas aconteciam no dia 1.
 *
 * A mistura tinha custo. Ao reescrever o fechamento — que fabricava guias e
 * declarava meses encerrados sem conferir — esta parte, que estava correta,
 * teria sido apagada junto. Separar preserva o que funciona.
 *
 * ── O que não faz ──────────────────────────────────────────────────────
 *
 * Não gera Pix. Cobrar de verdade exige uma integração de pagamento da
 * plataforma — não a do Asaas do tenant, que serve para o cliente cobrar OS
 * CLIENTES dele. Até lá a fatura nasce em aberto, sem meio de pagamento, e a
 * ausência é honesta: um `pixCode` inventado seria um código que não paga.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // Dia de São Paulo: em UTC o mês vira às 21h do último dia, e a fatura
  // sairia com o mês de referência errado.
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [ano, mes] = hoje.split('-').map(Number);
  const referenceMonth = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dueDate = `${ano}-${String(mes).padStart(2, '0')}-10`;

  try {
    const assinaturas = await withDbTimeout(
      db
        .select({
          companyId: subscription.companyId,
          nome: company.legalName,
          valor: plan.monthlyValue,
          desconto: subscription.discountValue,
          valorCombinado: subscription.customValue,
          motivoDesconto: subscription.discountReason,
          plano: plan.name,
          features: plan.features,
        })
        .from(subscription)
        .innerJoin(plan, eq(subscription.planId, plan.id))
        .innerJoin(company, eq(company.id, subscription.companyId))
        // Cliente encerrado não recebe fatura — ver 0065.
        .where(and(eq(subscription.status, 'ACTIVE'), isNull(company.closedAt))),
      8000,
    );

    const geradas: string[] = [];
    const jaExistiam: string[] = [];
    const erros: string[] = [];

    for (const a of assinaturas) {
      try {
        /**
         * Uma fatura por empresa por mês.
         *
         * A checagem é explícita porque não há índice único cobrindo
         * (company_id, reference_month) nesta tabela: rodar o cron duas vezes
         * — um retry da Vercel, uma chamada manual — cobraria o cliente duas
         * vezes pelo mesmo mês.
         */
        const [existe] = await withDbTimeout(
          db
            .select({ id: accountingInvoice.id })
            .from(accountingInvoice)
            .where(
              and(
                eq(accountingInvoice.companyId, a.companyId),
                eq(accountingInvoice.referenceMonth, referenceMonth),
                sql`${accountingInvoice.description} LIKE 'Honorários Contábeis%'`,
              ),
            ),
          8000,
        );

        if (existe) {
          jaExistiam.push(a.nome);
          continue;
        }

        /**
         * O desconto sai na descrição, com o preço cheio ao lado. É o que
         * mostra ao cliente o benefício que ele tem — e o que evita que um
         * desconto esquecido vire, sem ninguém notar, o preço da tabela.
         */
        const honorarios = {
          valorDoPlano: Number(a.valor),
          desconto: a.desconto,
          valorCombinado: a.valorCombinado,
        };
        const valorFinal = valorDosHonorarios(honorarios);
        const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        await withDbTimeout(
          db.insert(accountingInvoice).values({
            companyId: a.companyId,
            // A checagem de duplicidade acima procura por este prefixo.
            description: descricaoDosHonorarios({
              ...honorarios,
              // Na fatura vai o nome comercial. O interno ("Sem movimento")
              // diz ao escritório em que caixa o cliente está, e soaria para
              // ele como se não estivesse recebendo serviço nenhum.
              plano: nomeComercial(a.features) ?? a.plano,
              motivoDoDesconto: a.motivoDesconto,
            }),
            value: valorFinal.toFixed(2),
            referenceMonth,
            dueDate,
            status: 'OPEN',
            pixCode: null,
          }),
          8000,
        );
        geradas.push(`${a.nome} · ${a.plano} · ${brl(valorFinal)}`);
      } catch (err) {
        erros.push(`${a.nome}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      referenceMonth,
      geradas: geradas.length,
      detalhe: geradas,
      jaExistiam: jaExistiam.length,
      erros: erros.length ? erros : undefined,
    });
  } catch (error) {
    console.error('[cron/honorarios] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
