import { NextResponse } from 'next/server';
import { getDb, empresasParaFecharHoje } from '@hexxa/db';
import { fecharMesResolvendo } from '@/lib/server/agente-fechamento';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * FECHAMENTO PROGRAMADO — cada empresa no dia que o contador escolheu.
 *
 * ── O que esta rota fazia antes, e por que foi substituída ──────────────
 *
 * A versão anterior rodava no dia 1 para TODAS as empresas e fazia três
 * coisas erradas, todas em silêncio:
 *
 * 1. Gravava `monthly_closure` com `status: 'CLOSED'` a partir de um
 *    `SUM()` de receita e despesa, sem passar por nenhuma das verificações
 *    de fechamento. Declarava encerrado um mês que ninguém conferiu —
 *    inclusive meses com receita zero.
 *
 * 2. Fabricava uma guia de DAS pela alíquota NOMINAL. As guias de verdade
 *    chegam do OneFlow, apuradas, com PDF e Pix. O resultado eram duas
 *    guias para a mesma competência, e a fabricada aparecia para o cliente
 *    como cobrança a pagar. Havia R$ 34.762,50 assim no banco.
 *
 * 3. Gravava essa mesma alíquota nominal em `tax_history` — a tabela que o
 *    cálculo do imposto aproximado lê como se fosse a apuração real. Isso
 *    desfazia, todo dia 1, a correção que fez o imposto aproximado parar de
 *    superestimar. A nominal só coincide com a efetiva na primeira faixa.
 *
 * Nenhuma das três tinha como ser notada: o balanço fecha, a guia parece uma
 * guia, e a alíquota errada é um número plausível.
 *
 * ── O que faz agora ────────────────────────────────────────────────────
 *
 * Roda todo dia e pergunta quem fecha hoje. O dia é por empresa porque cada
 * cliente entrega o que falta num ritmo diferente — era o pedido que originou
 * `ConfigFechamento.diaDoFechamento`, e sem este cron ele não fazia nada.
 *
 * E não fecha nada sozinho: escritura o que faltava, confere contra as
 * verificações, resolve o que a IA pode resolver, e deixa o parecer na trilha
 * de agente. Declarar um período encerrado vai para aprovação humana, porque
 * é a base do que sobe para a contabilidade oficial.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  /**
   * O dia é o de São Paulo, não o do servidor.
   *
   * A Vercel roda em UTC, onde o dia vira às 21h daqui. Um fechamento
   * marcado para o dia 1 dispararia às 21h do dia 31 — fechando o mês antes
   * de ele acabar.
   */
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  try {
    const empresas = await empresasParaFecharHoje(db, hoje);

    if (!empresas.length) {
      return NextResponse.json({ hoje, mensagem: 'Nenhuma empresa fecha hoje.', empresas: [] });
    }

    const relatorio = [];
    for (const emp of empresas) {
      try {
        const r = await fecharMesResolvendo(emp.id, emp.referenceMonth, { trigger: 'CRON' });
        relatorio.push({
          empresa: emp.nome,
          mes: emp.referenceMonth,
          diaConfigurado: emp.diaDoFechamento,
          podeFechar: r.podeFechar,
          resumo: r.resumo,
          bloqueios: r.bloqueios.map((b) => b.titulo),
          atencoes: r.atencoes.map((a) => a.titulo),
          escrituradas: r.escrituradas,
          resolvidoPelaIA: r.resolvido,
          pedidosAoCliente: r.aindaPrecisaDoCliente,
          aguardandoAprovacao: r.acaoFechamentoId ?? null,
        });
      } catch (err) {
        // Uma empresa que falha não derruba as outras — mesmo isolamento por
        // documento que a escrituração usa.
        relatorio.push({
          empresa: emp.nome,
          mes: emp.referenceMonth,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ hoje, empresas: relatorio });
  } catch (error) {
    console.error('[cron/fechamento] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
