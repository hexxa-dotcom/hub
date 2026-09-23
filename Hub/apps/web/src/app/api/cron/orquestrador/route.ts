import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * ORQUESTRADOR DAS ROTINAS — dois agendamentos que valem por doze.
 *
 * ── Por que existe ──────────────────────────────────────────────────────
 *
 * O plano Hobby da Vercel aceita só 2 crons, e o Hub tem 12 rotinas. Cortar
 * para 2 deixou dez delas sem rodar: nada ia para o OneFlow, nada voltava,
 * nada era classificado. Em vez de escolher quais sobrevivem, os dois crons
 * chamam esta rota, cada um com um turno, e ela dispara as rotinas daquele
 * turno na ordem certa.
 *
 * ── Como cabe nos 300s ──────────────────────────────────────────────────
 *
 * Cada rotina já usa até 300s sozinha, então não dá para rodá-las dentro
 * desta função. Ela chama cada uma por HTTP: cada chamada é uma invocação
 * própria, com seus próprios 300s. As de uma mesma ONDA rodam em paralelo e
 * esta rota espera todas terminarem — o que cabe, porque em paralelo o total
 * é o da mais lenta. A onda seguinte começa numa nova invocação desta rota
 * (`?onda=N`), para que cada onda tenha 300s inteiros.
 *
 * ── Por que ondas, e não tudo em paralelo ───────────────────────────────
 *
 * As rotinas do OneFlow espaçam as chamadas para respeitar a cota (500/dia)
 * e o limite por segundo. Duas delas ao mesmo tempo dividiriam esse ritmo
 * e estourariam. Por isso nunca há duas rotinas do OneFlow na mesma onda.
 * E a ordem importa: a nota vai antes do lançamento, o envio antes do
 * resultado, a escrituração antes do fechamento.
 *
 * ── Os dois turnos ──────────────────────────────────────────────────────
 *
 * Madrugada: tudo que prepara e envia. Manhã: tudo que colhe o que o OneFlow
 * processou nesse meio-tempo, e fecha. As horas de separação são o tempo que
 * o OneFlow leva para apurar — o antigo agendamento já as respeitava.
 */

type Rotina = { caminho: string; quando?: () => boolean };
type Onda = Rotina[];

/** Dia de hoje em São Paulo — em UTC o mês vira às 21h do último dia. */
function diaEmSaoPaulo(): number {
  return Number(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-')[2],
  );
}

const TURNOS: Record<string, Onda[]> = {
  madrugada: [
    [
      { caminho: 'escrituracao' },
      { caminho: 'envio-nfse-oneflow' },
      { caminho: 'despesas-fixas' },
      { caminho: 'cobranca' },
    ],
    [{ caminho: 'envio-oneflow' }],
    // Segunda passada: o envio para pelo relógio antes dos 300s e retoma
    // de onde parou — o agendamento antigo também rodava duas vezes.
    [{ caminho: 'envio-oneflow' }],
  ],
  manha: [
    [{ caminho: 'resultado-oneflow' }, { caminho: 'nibo-sync' }],
    [{ caminho: 'classificacao' }, { caminho: 'nfse-status' }],
    [
      { caminho: 'retorno-oneflow' },
      // A rota de honorários não olha o dia: fatura sempre que chamada.
      { caminho: 'honorarios', quando: () => diaEmSaoPaulo() === 1 },
    ],
    [{ caminho: 'fechamento' }],
  ],
};

type Resultado = { rotina: string; status: number | 'erro' | 'pulada'; corpo?: unknown };

async function chamar(origem: string, auth: string, rotina: Rotina): Promise<Resultado> {
  if (rotina.quando && !rotina.quando()) return { rotina: rotina.caminho, status: 'pulada' };
  try {
    const res = await fetch(`${origem}/api/cron/${rotina.caminho}`, {
      headers: { authorization: auth },
      cache: 'no-store',
      signal: AbortSignal.timeout(295_000),
    });
    const corpo = await res.json().catch(() => null);
    return { rotina: rotina.caminho, status: res.status, corpo };
  } catch (error: any) {
    return { rotina: rotina.caminho, status: 'erro', corpo: error?.message };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const turno = url.searchParams.get('turno') ?? '';
  const ondas = TURNOS[turno];
  if (!ondas) {
    return NextResponse.json({ error: `Turno desconhecido: "${turno}"` }, { status: 400 });
  }
  const indice = Number(url.searchParams.get('onda') ?? '0');
  const onda = ondas[indice];
  if (!onda) return NextResponse.json({ error: `Onda ${indice} não existe` }, { status: 400 });

  const resultados = await Promise.all(onda.map((r) => chamar(url.origin, authHeader, r)));
  for (const r of resultados) {
    if (r.status !== 200 && r.status !== 'pulada') {
      console.error(`[orquestrador] ${turno}/${indice} ${r.rotina} falhou:`, r.status, r.corpo);
    }
  }

  // Encadeia a próxima onda numa invocação nova. Uma rotina que falhou não
  // segura as outras: cada uma decide sozinha se tem o que fazer.
  let proxima: number | null = null;
  if (indice + 1 < ondas.length) {
    const seguinte = new URL(url);
    seguinte.searchParams.set('onda', String(indice + 1));
    try {
      // Só espera a chamada sair: a próxima onda roda na própria invocação,
      // e esta aqui não precisa ficar viva por ela.
      await fetch(seguinte, {
        headers: { authorization: authHeader },
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Timeout esperado — a requisição já chegou e segue do outro lado.
    }
    proxima = indice + 1;
  }

  return NextResponse.json({ turno, onda: indice, resultados, proxima });
}
