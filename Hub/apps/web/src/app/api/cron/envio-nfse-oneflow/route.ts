import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import {
  getDb,
  appHashPorCnpj,
  cotaParaRotina,
  empresasComAgenteLigado,
  ensaiarEnvioNfse,
  enviarNfseParaOneflow,
} from '@hexxa/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// A cota de cada rotina vem de `cotaParaRotina` (turnos e prioridade — oneflow-client.ts).

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const url = new URL(request.url);
  const forcada = url.searchParams.get('competencia');

  if (!forcada && dia! > 5) {
    return NextResponse.json({ hoje, mensagem: 'Fora da janela (dias 1 a 5). Nada a fazer.' });
  }

  const anterior = new Date(Date.UTC(ano!, mes! - 2, 1));
  const competencia =
    forcada ?? `${anterior.getUTCFullYear()}${String(anterior.getUTCMonth() + 1).padStart(2, '0')}`;

  const db = getDb();
  const prazo = Date.now() + 250_000;

  try {
    const ligadas = await empresasComAgenteLigado(db, 'envioOneflow');
    const relatorio: Record<string, unknown>[] = [];

    for (const e of ligadas) {
      if (Date.now() > prazo) break;

      // Ensaio local primeiro: sem nota pendente, nenhuma chamada.
      const ensaio = await ensaiarEnvioNfse(db, e.id, competencia);
      if (ensaio.prontas.length === 0) {
        if (ensaio.bloqueadas.length) {
          relatorio.push({ empresa: e.nome, bloqueadas: ensaio.bloqueadas.map((b) => `${b.numero ?? '—'}: ${b.motivo}`) });
        }
        continue;
      }

      if ((await cotaParaRotina(db, 'nfse')) < 2) {
        relatorio.push({ empresa: e.nome, adiado: 'cota do dia reservada para a volta das guias' });
        break;
      }

      const [dados] = (await db.execute(sql`SELECT cnpj FROM company WHERE id = ${e.id}`)) as unknown as { cnpj: string }[];
      const appHash = dados ? await appHashPorCnpj(db, dados.cnpj, e.id) : null;
      if (!appHash) {
        relatorio.push({ empresa: e.nome, erro: 'não cadastrada no OneFlow' });
        continue;
      }

      const r = await enviarNfseParaOneflow(db, e.id, appHash, competencia);
      relatorio.push({
        empresa: e.nome,
        enviadas: r.enviadas,
        jaEstavamLa: r.jaNoOneflow.length,
        bloqueadas: r.bloqueadas.length,
        erros: r.erros.map((x) => x.motivo),
      });
    }

    return NextResponse.json({ competencia, empresas: relatorio });
  } catch (error) {
    console.error('[cron/envio-nfse-oneflow] falhou:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
