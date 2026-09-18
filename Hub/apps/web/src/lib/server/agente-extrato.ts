import 'server-only';
import { getDb, eq, movimentosNaTransitoria, reclassificarMovimento } from '@hexxa/db';
import { category } from '@hexxa/db/schema';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { callLlmJson } from '@hexxa/integrations';

/**
 * AGENTE DO EXTRATO — identifica o que caiu na transitória.
 *
 * É o segundo turno da conciliação. O primeiro já resolveu o que dava para
 * resolver por fato: o que casou com um lançamento aberto virou baixa, o que
 * repetiu uma descrição já classificada herdou a conta. O que sobra aqui é o
 * que nunca se viu antes — e é justamente onde um modelo ajuda.
 *
 * ── O que ele NÃO faz ───────────────────────────────────────────────────
 *
 * - Não inventa conta. Escolhe entre as categorias que existem, e resposta com
 *   id inválido é descartada, não "corrigida".
 * - Não mexe em partida publicada. A correção é por estorno, pelo caminho do
 *   razão, com a partida antiga preservada e marcada.
 * - Não decide sozinho o que é caro. Movimento acima do limite vai para a fila
 *   do contador mesmo quando o modelo está certo, porque a régua de autonomia
 *   é por VALOR e reversibilidade, nunca por confiança do modelo.
 */

const SYSTEM = `Você é um contador brasileiro identificando movimentações bancárias no plano de contas da ITG 1000 (Anexo 7).

Receberá o plano de categorias da empresa e uma lista de movimentos do extrato que ninguém conseguiu identificar — nem pelo histórico da empresa, nem por um lançamento em aberto correspondente.

Valor NEGATIVO é dinheiro que SAIU da conta (despesa ou pagamento). Valor POSITIVO é dinheiro que ENTROU (receita ou recebimento).

Regras invioláveis:
- Use APENAS ids que estejam na lista de categorias. Nunca invente um id.
- Movimento de saída só recebe categoria de despesa (EXPENSE); de entrada, só receita (INCOME).
- Descrição de extrato é curta e cheia de ruído. Se ela não permitir decidir com segurança, OMITA o movimento da resposta. Deixar sem identificar é melhor que identificar errado: errado entra no balanço e alguém decide com base nele.
- Transferência entre contas da mesma empresa NÃO é receita nem despesa. Se a descrição sugerir isso, omita.
- A justificativa é lida por um contador: diga o que na descrição levou à escolha, em uma frase.

Responda SOMENTE um array JSON:
[{"id":"<bankTransactionId>","categoria_id":"<id da categoria>","justificativa":"<uma frase>","confianca":<0 a 1>}]`;

interface Sugestao {
  id: string;
  categoria_id: string;
  justificativa: string;
  confianca: number;
}

export interface ResultadoExtrato {
  analisados: number;
  identificados: number;
  paraRevisao: number;
  descartados: { id: string; motivo: string }[];
  erros: string[];
  disponivel: boolean;
}

/**
 * Acima disto, a identificação vai para a fila do contador em vez de valer.
 *
 * Por VALOR, não por confiança: um movimento de R$ 40 mil classificado errado
 * distorce o balanço mesmo que o modelo estivesse convicto, e um de R$ 30 mal
 * classificado se corrige no mês seguinte sem consequência. É a mesma régua
 * que governa as outras ações do sistema.
 */
const LIMITE_AUTOMATICO = 2_000;

export async function identificarMovimentos(
  companyId: string,
  opts: { limite?: number } = {},
): Promise<ResultadoExtrato> {
  const vazio: ResultadoExtrato = {
    analisados: 0, identificados: 0, paraRevisao: 0,
    descartados: [], erros: [], disponivel: true,
  };

  const creds = await resolveCredentials();
  if (!creds) return { ...vazio, disponivel: false };

  const db = getDb();
  const movimentos = await movimentosNaTransitoria(db, companyId, opts.limite ?? 40);
  if (!movimentos.length) return vazio;

  const categorias = await db
    .select({ id: category.id, nome: category.name, tipo: category.kind, codigo: category.accountingCode })
    .from(category)
    .where(eq(category.companyId, companyId));

  const utilizaveis = categorias.filter((c) => c.codigo);
  if (!utilizaveis.length) {
    return { ...vazio, analisados: movimentos.length, erros: ['Empresa sem categorias com código contábil.'] };
  }

  const contexto =
    `CATEGORIAS DISPONÍVEIS:\n` +
    utilizaveis.map((c) => `${c.id} | ${c.tipo} | ${c.codigo} | ${c.nome}`).join('\n') +
    `\n\nMOVIMENTOS DO EXTRATO A IDENTIFICAR:\n` +
    movimentos
      .map((m) => `${m.bankTransactionId} | ${m.data} | R$ ${m.valor.toFixed(2)} | ${m.descricao}`)
      .join('\n');

  const motor = await resolverMotor(creds);

  let sugestoes: Sugestao[];
  try {
    const r = await callLlmJson<Sugestao[]>(motor, { system: SYSTEM, user: contexto, maxTokens: 4000 });
    if (!r.dados) {
      return {
        ...vazio,
        analisados: movimentos.length,
        erros: [`Resposta do modelo não continha JSON válido: ${r.texto.slice(0, 200)}`],
      };
    }
    sugestoes = r.dados;
  } catch (err) {
    return {
      ...vazio,
      analisados: movimentos.length,
      erros: [err instanceof Error ? err.message : String(err)],
    };
  }

  const out: ResultadoExtrato = { ...vazio, analisados: movimentos.length };
  const porId = new Map(movimentos.map((m) => [m.bankTransactionId, m]));
  const contaDaCategoria = new Map(utilizaveis.map((c) => [c.id, { codigo: c.codigo!, tipo: c.tipo, nome: c.nome }]));
  const jaVistos = new Set<string>();

  for (const s of Array.isArray(sugestoes) ? sugestoes : []) {
    const mov = porId.get(s?.id ?? '');
    const cat = contaDaCategoria.get(s?.categoria_id ?? '');

    // As três guardas contra alucinação: movimento que não está na fila,
    // categoria que não existe, e resposta repetida para o mesmo movimento.
    if (!mov) { out.descartados.push({ id: String(s?.id), motivo: 'movimento fora da fila enviada' }); continue; }
    if (!cat) { out.descartados.push({ id: s.id, motivo: `categoria ${s.categoria_id} não existe` }); continue; }
    if (jaVistos.has(s.id)) { out.descartados.push({ id: s.id, motivo: 'sugestão repetida' }); continue; }
    jaVistos.add(s.id);

    // Sinal contra natureza: saída só vira despesa, entrada só vira receita.
    const esperado = mov.valor < 0 ? 'EXPENSE' : 'INCOME';
    if (cat.tipo !== esperado) {
      out.descartados.push({
        id: s.id,
        motivo: `categoria ${cat.tipo} para movimento de ${mov.valor < 0 ? 'saída' : 'entrada'}`,
      });
      continue;
    }

    if (Math.abs(mov.valor) > LIMITE_AUTOMATICO) {
      out.paraRevisao++;
      continue;
    }

    const r = await reclassificarMovimento(
      db, companyId, mov.bankTransactionId, cat.codigo,
      `Identificado pela IA como "${cat.nome}": ${String(s.justificativa ?? '').slice(0, 160)}`,
    );
    if (r.ok) out.identificados++;
    else out.descartados.push({ id: s.id, motivo: r.erro ?? 'falha ao reclassificar' });
  }

  return out;
}
