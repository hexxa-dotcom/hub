import 'server-only';
import { getDb, sql, consultarConhecimento, aprender } from '@hexxa/db';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { classificarLancamento } from './agent-tools';
import { SYSTEM_CLASSIFICAR, SYSTEM_REVISAR, contextoDaEmpresa, chamar, registrar, type Classificacao, type Revisao, type Conta } from './agente-extrato';

/**
 * AGENTE CLASSIFICADOR — dá categoria aos lançamentos que chegaram sem.
 *
 * Segue a mesma regra do extrato: NADA É APLICADO SEM CERTEZA.
 *
 * 1. O que a base de conhecimento já sabe (o contador, o empresário ou a IA
 *    verificada ensinaram) é aplicado direto.
 * 2. O resto vai ao modelo com o contexto inteiro da empresa, e uma segunda
 *    passada, independente e instruída a desconfiar, confere. Concordou: é
 *    aplicado, e a base aprende.
 * 3. Não concordou, ou o modelo não soube: a sugestão vai para "Esperando
 *    você decidir" — sem porcentagem, com o motivo. A decisão ensina a base.
 *
 * O que ele NÃO faz:
 *
 * - Não escreve direto. Passa por `classificarLancamento` → `propor`, que
 *   grava a trilha e aplica a régua (valor alto continua indo para revisão).
 * - Não inventa categoria: id fora da lista, tipo trocado ou lançamento fora
 *   do lote são descartados, não "corrigidos".
 */

export interface ResultadoClassificacao {
  analisados: number;
  aplicados: number;
  aguardandoAprovacao: number;
  descartados: { id: string; motivo: string }[];
  erros: string[];
  /** `false` quando a IA está desligada ou sem chave configurada. */
  disponivel: boolean;
}

interface Lancamento {
  id: string;
  descricao: string;
  valor: number; // com sinal: a pagar é negativo, como no extrato
  tipo: 'PAYABLE' | 'RECEIVABLE';
  vencimento: string;
}

export async function classificarPendentes(
  companyId: string,
  opts: { limite?: number; userId?: string | null } = {},
): Promise<ResultadoClassificacao> {
  const out: ResultadoClassificacao = { analisados: 0, aplicados: 0, aguardandoAprovacao: 0, descartados: [], erros: [], disponivel: true };
  const db = getDb();

  // Sem categoria e sem uma sugestão já esperando decisão — não se pergunta duas vezes.
  const pendentes = (
    (await db.execute(sql`
      SELECT e.id::text, coalesce(e.description, '') AS descricao, e.amount::float AS valor, e.type AS tipo,
             to_char(e.due_date, 'YYYY-MM-DD') AS vencimento
        FROM financial_entry e
       WHERE e.company_id = ${companyId} AND e.category_id IS NULL AND e.status <> 'CANCELED' AND e.amount > 0
         -- A provisão de imposto não é despesa a classificar: é o imposto estimado, que tem conta própria.
         AND coalesce(e.description, '') NOT ILIKE 'Provisão de Imposto%'
         AND NOT EXISTS (
           SELECT 1 FROM agent_action a
            WHERE a.company_id = e.company_id AND a.target_id = e.id AND a.kind = 'CLASSIFICAR_LANCAMENTO'
              AND a.status = 'AWAITING_APPROVAL')
       ORDER BY e.due_date DESC
       LIMIT ${String(opts.limite ?? 40)}
    `)) as unknown as { id: string; descricao: string; valor: number; tipo: 'PAYABLE' | 'RECEIVABLE'; vencimento: string }[]
  ).map((l): Lancamento => ({ ...l, valor: l.tipo === 'PAYABLE' ? -l.valor : l.valor }));
  if (!pendentes.length) return out;
  out.analisados = pendentes.length;

  const categorias = (await db.execute(sql`
    SELECT id::text, name AS nome, kind AS tipo, accounting_code AS codigo
      FROM category WHERE company_id = ${companyId} AND accounting_code IS NOT NULL
  `)) as unknown as Conta[];
  if (!categorias.length) return { ...out, erros: ['Empresa sem categorias com código contábil.'] };
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const porCodigo = new Map(categorias.map((c) => [c.codigo, c]));
  const combina = (l: Lancamento, c: Conta | undefined) => !!c && c.tipo === (l.tipo === 'PAYABLE' ? 'EXPENSE' : 'INCOME');

  const aplicar = async (
    l: Lancamento,
    c: Conta,
    justificativa: string,
    extras: { nome: string; observado: string; peso: number }[],
    exigirAprovacao?: string,
  ) => {
    try {
      const r = await classificarLancamento({
        companyId,
        lancamentoId: l.id,
        categoriaId: c.id,
        justificativa,
        sinaisExtras: extras.map((e) => ({ ...e, forca: 1 })),
        exigirAprovacao,
        userId: opts.userId ?? null,
        trigger: 'CRON',
      });
      if (r.situacao === 'aplicado') out.aplicados++;
      else if (r.situacao === 'aguardando_aprovacao') out.aguardandoAprovacao++;
      else out.erros.push(`${l.id}: ${r.mensagem}`);
      return r.situacao === 'aplicado';
    } catch (err) {
      out.erros.push(`${l.id}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  // ── 1. O que a base já sabe ───────────────────────────────────────────────
  const paraIa: Lancamento[] = [];
  for (const l of pendentes) {
    const k = l.descricao ? await consultarConhecimento(db, companyId, l.descricao, l.valor) : null;
    const c = k ? porCodigo.get(k.conta) : undefined;
    if (k && c && combina(l, c)) {
      const quem = { CONTADOR: 'o contador', EMPRESARIO: 'o empresário', IA_VERIFICADA: 'a IA, conferida', LANCAMENTO: 'um lançamento já conciliado' }[k.origem];
      await aplicar(l, c, `Já ensinado por ${quem}: "${c.nome}".`, [
        { nome: 'conhecimento', observado: `A base de conhecimento já identifica esta descrição como "${c.nome}" (ensinado por ${quem}).`, peso: 4 },
      ]);
    } else {
      paraIa.push(l);
    }
  }
  if (!paraIa.length) return out;

  const creds = await resolveCredentials();
  if (!creds) return { ...out, disponivel: false };

  // ── 2. A IA com contexto, e a conferência ─────────────────────────────────
  const contexto = await contextoDaEmpresa(companyId, categorias);
  const motor = await resolverMotor(creds, 'conciliacao');
  const lista = paraIa.map((l) => `${l.id} | ${l.vencimento} | R$ ${l.valor.toFixed(2)} | ${l.tipo === 'PAYABLE' ? 'conta a pagar' : 'conta a receber'} | ${l.descricao}`).join('\n');

  const c1 = await chamar<Classificacao[]>(motor, SYSTEM_CLASSIFICAR, `${contexto}\n\nLANÇAMENTOS A IDENTIFICAR:\n${lista}`);
  if (!c1.ok) return { ...out, erros: [c1.erro] };
  const classif = new Map((Array.isArray(c1.dados) ? c1.dados : []).filter((c) => c && typeof c.id === 'string').map((c) => [c.id, c]));

  const propostos = paraIa.filter((l) => {
    const c = classif.get(l.id);
    return !!c?.categoria_id && combina(l, porId.get(c.categoria_id));
  });
  let revisoes = new Map<string, Revisao>();
  let r2: Awaited<ReturnType<typeof chamar<Revisao[]>>> | null = null;
  if (propostos.length) {
    const aRevisar = propostos
      .map((l) => {
        const c = classif.get(l.id)!;
        const conta = porId.get(c.categoria_id!)!;
        return `${l.id} | ${l.vencimento} | R$ ${l.valor.toFixed(2)} | ${l.descricao} → PROPOSTA: ${conta.id} (${conta.nome}) · motivo: ${c.motivo ?? '—'}`;
      })
      .join('\n');
    r2 = await chamar<Revisao[]>(motor, SYSTEM_REVISAR, `${contexto}\n\nIDENTIFICAÇÕES A REVISAR:\n${aRevisar}`);
    if (r2.ok) revisoes = new Map((Array.isArray(r2.dados) ? r2.dados : []).filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r]));
  }

  // ── 3. Decidir ────────────────────────────────────────────────────────────
  const resultado: Record<string, string> = {};
  for (const l of paraIa) {
    const c = classif.get(l.id);
    const r = revisoes.get(l.id);
    const proposta = c?.categoria_id ? porId.get(c.categoria_id) : undefined;

    if (proposta && combina(l, proposta) && r?.concorda === true) {
      const ok = await aplicar(l, proposta, c!.motivo ?? `Identificado como "${proposta.nome}".`, [
        { nome: 'modelo', observado: `A IA identificou como "${proposta.nome}": ${c!.motivo ?? ''}`, peso: 1 },
        { nome: 'conferencia', observado: `Uma segunda leitura independente concordou: ${r.motivo ?? ''}`, peso: 3 },
      ]);
      if (ok) await aprender(db, companyId, { descricao: l.descricao, valor: l.valor, conta: proposta.codigo, categoriaNome: proposta.nome, origem: 'IA_VERIFICADA' });
      resultado[l.id] = ok ? `aplicado:${proposta.codigo}` : 'revisao';
      continue;
    }

    // Sem certeza: a melhor sugestão disponível espera decisão.
    const correcao = r && !r.concorda && r.categoria_id ? porId.get(r.categoria_id) : undefined;
    const alternativa = (c?.alternativas ?? []).map((id) => porId.get(id)).find((x) => combina(l, x));
    const sugestao = [correcao, proposta, alternativa].find((x) => combina(l, x));
    if (!sugestao) {
      out.descartados.push({ id: l.id, motivo: 'sem base para sugerir — aparece sem categoria no fechamento' });
      resultado[l.id] = 'sem_base';
      continue;
    }
    const motivo = r && !r.concorda
      ? `A conferência não confirmou${r.motivo ? `: ${r.motivo}` : ''}.`
      : c?.motivo ?? 'A IA não teve base para decidir sozinha.';
    await aplicar(l, sugestao, motivo, [], 'A conferência independente não confirmou esta classificação — ela só vale depois da sua decisão.');
    resultado[l.id] = r && !r.concorda ? 'aprovacao:revisor_discordou' : 'aprovacao:sem_base';
  }

  await registrar(companyId, 'CLASSIFICAR_LANCAMENTOS', motor.model, { lancamentos: paraIa.length }, { classificacao: c1.dados, revisao: r2?.ok ? r2.dados : null }, resultado, c1, r2);
  return out;
}
