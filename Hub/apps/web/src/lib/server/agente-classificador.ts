import 'server-only';
import { getDb, eq, and, sql } from '@hexxa/db';
import { financialEntry, category } from '@hexxa/db/schema';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { callLlmJson } from '@hexxa/integrations';
import { classificarLancamento } from './agent-tools';
import { validarSugestoes } from '@hexxa/core';

/**
 * AGENTE CLASSIFICADOR.
 *
 * É o primeiro agente que faz trabalho de contador de verdade neste sistema, e
 * ataca a lacuna mais cara que a auditoria encontrou: **100% dos lançamentos
 * estão sem categoria**. Com isso, toda a despesa das empresas aparece no
 * balancete numa única conta "Despesas Diversas a Classificar", a DRE sai sem
 * sentido, e o fechamento bloqueia.
 *
 * O que ele NÃO faz, de propósito:
 *
 * - Não escreve direto. Passa por `classificarLancamento`, que passa por
 *   `propor`, que aplica a régua de autonomia e grava a trilha.
 * - Não decide a própria confiança. O modelo dá uma opinião de peso 1; o que
 *   pesa 3 é o histórico real de classificações da empresa.
 * - Não inventa categoria. Só escolhe entre as que existem no plano de contas,
 *   e uma resposta com id inválido é descartada, não "corrigida".
 *
 * A última é a que mais importa: um LLM pedido para classificar devolve com
 * prazer uma categoria plausível que não existe. Aceitar isso seria deixar a
 * alucinação entrar no razão pela porta da frente.
 */


const SYSTEM = `Você é um contador brasileiro classificando lançamentos financeiros no plano de contas da ITG 1000 (Anexo 7).

Receberá o plano de categorias da empresa e uma lista de lançamentos sem classificação. Para cada lançamento, escolha a categoria MAIS ESPECÍFICA que se aplique.

Regras invioláveis:
- Use APENAS ids que estejam na lista de categorias. Nunca invente um id.
- Lançamento a pagar (PAYABLE) só recebe categoria de despesa (EXPENSE); a receber (RECEIVABLE) só recebe receita (INCOME).
- Se a descrição não permitir decidir com segurança, OMITA o lançamento da resposta. Deixar sem classificar é melhor que classificar errado — errado vai para a DRE e alguém decide com base nele.
- A justificativa é lida por um contador: diga o que na descrição levou à escolha, em uma frase.

Responda SOMENTE um array JSON:
[{"id":"<id do lançamento>","categoria_id":"<id da categoria>","justificativa":"<uma frase>","confianca":<0 a 1>}]`;

interface Sugestao {
  id: string;
  categoria_id: string;
  justificativa: string;
  confianca: number;
}


export interface ResultadoClassificacao {
  analisados: number;
  aplicados: number;
  aguardandoAprovacao: number;
  descartados: { id: string; motivo: string }[];
  erros: string[];
  /** `false` quando a IA está desligada ou sem chave configurada. */
  disponivel: boolean;
}

/**
 * Classifica lançamentos sem categoria de uma empresa.
 *
 * Trabalha em lote — um lançamento por chamada ao modelo custaria caro e daria
 * ao modelo menos contexto para distinguir casos parecidos entre si.
 */
export async function classificarPendentes(
  companyId: string,
  opts: { limite?: number; userId?: string | null } = {},
): Promise<ResultadoClassificacao> {
  const vazio: ResultadoClassificacao = {
    analisados: 0,
    aplicados: 0,
    aguardandoAprovacao: 0,
    descartados: [],
    erros: [],
    disponivel: true,
  };

  // Mesma configuração das dicas de tela: provedor, chave e o liga/desliga
  // geral. Desligar a IA em /contador/configuracoes/ia-insights desliga o
  // agente junto — um só interruptor para tudo que custa token.
  const creds = await resolveCredentials();
  if (!creds) return { ...vazio, disponivel: false };

  const db = getDb();
  const limite = opts.limite ?? 40;

  const pendentes = await db
    .select({
      id: financialEntry.id,
      descricao: financialEntry.description,
      valor: financialEntry.amount,
      tipo: financialEntry.type,
      origem: financialEntry.source,
    })
    .from(financialEntry)
    .where(
      and(
        eq(financialEntry.companyId, companyId),
        sql`${financialEntry.categoryId} IS NULL`,
        sql`${financialEntry.status} <> 'CANCELED'`,
        sql`${financialEntry.amount} > 0`,
      ),
    )
    .limit(limite);

  if (!pendentes.length) return vazio;

  const categorias = await db
    .select({
      id: category.id,
      nome: category.name,
      tipo: category.kind,
      codigo: category.accountingCode,
    })
    .from(category)
    .where(eq(category.companyId, companyId));

  if (!categorias.length) {
    return { ...vazio, erros: ['Empresa sem plano de categorias cadastrado.'] };
  }

  const contexto =
    `CATEGORIAS DISPONÍVEIS:\n` +
    categorias.map((c) => `${c.id} | ${c.tipo} | ${c.codigo ?? 's/código'} | ${c.nome}`).join('\n') +
    `\n\nLANÇAMENTOS A CLASSIFICAR:\n` +
    pendentes
      .map((p) => `${p.id} | ${p.tipo} | R$ ${p.valor} | origem:${p.origem} | ${p.descricao}`)
      .join('\n');

  // O gateway cuida do provedor e do recorte do JSON. Este módulo só sabe
  // montar o contexto e validar a resposta — é o que o mantém igual quando o
  // motor muda.
  let sugestoes: Sugestao[];
  try {
    const motor = await resolverMotor(creds);
    const r = await callLlmJson<Sugestao[]>(motor, { system: SYSTEM, user: contexto, maxTokens: 4000 });
    sugestoes = r.dados ?? [];
    if (!r.dados) {
      return {
        ...vazio,
        analisados: pendentes.length,
        erros: [`Resposta do modelo não continha JSON válido: ${r.texto.slice(0, 200)}`],
      };
    }
  } catch (err) {
    return { ...vazio, analisados: pendentes.length, erros: [err instanceof Error ? err.message : String(err)] };
  }

  const out: ResultadoClassificacao = { ...vazio, analisados: pendentes.length };

  // As travas vivem em @hexxa/core, puras e testadas: id de categoria que não
  // existe, tipo trocado, lançamento fora do lote, contradição. Tê-las aqui
  // dentro, junto da chamada de rede, tornava impossível testá-las — e são
  // justamente elas que impedem a resposta de um LLM de virar lançamento.
  const { aceitas, descartados } = validarSugestoes(
    sugestoes,
    pendentes.map((p) => ({ id: p.id, tipo: p.tipo })),
    categorias.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo as 'INCOME' | 'EXPENSE' })),
  );
  out.descartados = descartados;

  for (const a of aceitas) {
    try {
      const r = await classificarLancamento({
        companyId,
        lancamentoId: a.lancamentoId,
        categoriaId: a.categoriaId,
        justificativa: a.justificativa,
        opiniaoModelo: { autoavaliacao: a.autoavaliacao, justificativa: a.justificativa },
        userId: opts.userId ?? null,
        trigger: 'CRON',
      });

      if (r.situacao === 'aplicado') out.aplicados++;
      else if (r.situacao === 'aguardando_aprovacao') out.aguardandoAprovacao++;
      else out.erros.push(`${a.lancamentoId}: ${r.mensagem}`);
    } catch (err) {
      out.erros.push(`${a.lancamentoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return out;
}
