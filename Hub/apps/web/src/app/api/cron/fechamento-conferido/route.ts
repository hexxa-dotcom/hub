import { NextResponse } from 'next/server';
import { getDb, empresasComAgenteLigado } from '@hexxa/db';
import { fecharMesResolvendo } from '@/lib/server/agente-fechamento';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Fechamento CONFERIDO do mês anterior.
 *
 * Substitui o comportamento de `/api/cron/fechamento`, que somava receita e
 * despesa e gravava `status: 'CLOSED'` sem verificar nada — declarando fechado
 * um mês que não tinha conferido.
 *
 * Esta rota não fecha nada. Ela escritura o que faltava, confere o mês contra
 * oito verificações e deixa o parecer registrado na trilha de agente. Fechar
 * de fato exige aprovação humana, porque declarar um período encerrado é a
 * base do que vai à contabilidade oficial — e a régua de autonomia trata isso
 * como irreversível.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const hoje = new Date();
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mes = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const empresas = await empresasComAgenteLigado(db, 'fechamento');
    void db;
    const relatorio = [];

    for (const emp of empresas) {
      try {
        const r = await fecharMesResolvendo(emp.id, mes, { trigger: 'CRON' });
        relatorio.push({
          empresa: emp.nome,
          podeFechar: r.podeFechar,
          resumo: r.resumo,
          bloqueios: r.bloqueios.map((b) => b.titulo),
          atencoes: r.atencoes.map((a) => a.titulo),
          escrituradas: r.escrituradas,
          // O que a IA consertou sozinha, sem incomodar ninguém.
          resolvidoPelaIA: r.resolvido,
          // O que sobrou e só o cliente responde — na língua dele.
          pedidosAoCliente: r.aindaPrecisaDoCliente,
          aguardandoAprovacao: r.acaoFechamentoId ?? null,
        });
      } catch (err) {
        // Uma empresa que falha não derruba as outras — mesma razão do
        // isolamento por documento na escrituração.
        relatorio.push({
          empresa: emp.nome,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ mes, empresas: relatorio });
  } catch (error) {
    console.error('[cron/fechamento-conferido] falhou:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
