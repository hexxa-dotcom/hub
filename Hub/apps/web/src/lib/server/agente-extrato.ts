import 'server-only';
import { getDb, sql, movimentosNaTransitoria, reclassificarMovimento, aprender, exemplosDoConhecimento, consultarConhecimento, garantirCategoriasPadrao, saidaParaSocio } from '@hexxa/db';
import { ACCOUNTS } from '@hexxa/core';
import { resolveCredentials } from './ai-insight';
import { resolverMotor } from './llm-config';
import { escolherComJev, jevDisponivel, CONFIANCA_PARA_LANCAR, type EscolhaDoJev } from './jev';
import { callLlmJson, type LlmConfig } from '@hexxa/integrations';

/**
 * AGENTE DO EXTRATO — identifica o que caiu na transitória.
 *
 * É o terceiro turno da conciliação. O primeiro casou o que bateu com um
 * lançamento; o segundo usou a base de conhecimento (o que alguém já ensinou).
 * O que sobra aqui é o que o sistema nunca viu — e a regra é uma só:
 *
 *   NADA ENTRA NO BALANÇO SEM CERTEZA.
 *
 * Por isso não existe "60% de confiança" nesta tela. Cada movimento termina
 * de um de dois jeitos:
 *
 * 1. IDENTIFICADO E VERIFICADO — o modelo classificou com o contexto inteiro
 *    da empresa (atividade, sócios, clientes, fornecedores das notas, contas
 *    em aberto, o que já foi ensinado) e um SEGUNDO passe, independente e
 *    instruído a desconfiar, concordou. Só então vale, e a base aprende.
 * 2. UMA PERGUNTA — qualquer dúvida (o modelo se absteve, o revisor
 *    discordou, o valor é alto) vira uma pergunta direta ao empresário, com
 *    as opções prováveis. A resposta ensina a base; na próxima vez aquele
 *    movimento se resolve sozinho.
 *
 * Tudo que o modelo recebe e devolve fica em `registro_da_ia`.
 *
 * ── O que ele NÃO faz ───────────────────────────────────────────────────
 *
 * - Não inventa conta. Escolhe entre as categorias que existem (e duas contas
 *   especiais: transferência entre contas próprias e lucros a sócios).
 * - Não aceita a própria opinião: sem a concordância do revisor, pergunta.
 * - Não decide sozinho o que é caro: acima do limite vira pergunta mesmo com
 *   as duas passadas de acordo, com a sugestão já marcada.
 */

/** Acima disto, sempre pergunta — e o contador confere a resposta. */
const LIMITE_AUTOMATICO = 2_000;

/**
 * O padrão óbvio quando a IA não tem certeza (regra do escritório): entrada de
 * terceiro é receita de serviço — sem nota fica fora do OneFlow até ser
 * emitida; saída para terceiro é serviço contratado.
 */
const CONTA_PADRAO_ENTRADA = '3.1.1.01.01';
const CONTA_PADRAO_SAIDA = '3.3.2.02.06';

/** Contas que não são categoria de receita/despesa, mas são respostas certas comuns. */
const ESPECIAIS = [
  { id: 'ESPECIAL:TRANSFERENCIA', codigo: ACCOUNTS.BANCOS, nome: 'Transferência entre contas da própria empresa', tipo: 'AMBOS' as const },
  { id: 'ESPECIAL:LUCROS', codigo: ACCOUNTS.LUCROS_A_PAGAR, nome: 'Distribuição de lucros aos sócios', tipo: 'EXPENSE' as const },
];

const REGRAS = `Valor NEGATIVO é dinheiro que SAIU da conta; POSITIVO é dinheiro que ENTROU.
- Use APENAS ids da lista de contas. Nunca invente um id.
- Saída só recebe conta de despesa (EXPENSE) ou especial de saída; entrada só recebe receita (INCOME) ou transferência.
- Transferência entre contas da própria empresa (mesmo titular, conta da lista de contas próprias) NÃO é receita nem despesa: use ESPECIAL:TRANSFERENCIA.
- Dinheiro que sai para um SÓCIO da lista, sem ser pró-labore, é distribuição de lucros: ESPECIAL:LUCROS.
- Use o contexto: um nome ou CNPJ que aparece na lista de clientes, fornecedores das notas, sócios ou funcionários diz quem é a outra parte.
- O que já foi ensinado (exemplos) vale como verdade para descrições iguais ou do mesmo fornecedor.`;

export const SYSTEM_CLASSIFICAR = `Você é um contador brasileiro identificando movimentações bancárias no plano de contas da ITG 1000 (Anexo 7).

Você receberá o contexto da empresa e movimentos do extrato que ainda não foram identificados.

${REGRAS}
- Se não houver base para decidir, responda categoria_id null. Errado entra no balanço; em branco vira uma pergunta ao empresário — é sempre melhor perguntar.
- Em "alternativas", até 2 outras contas plausíveis (para montar a pergunta, se preciso).
- "motivo" é lido pelo empresário: diga, em uma frase curta e simples, o que na descrição ou no contexto levou à escolha.

Responda SOMENTE um array JSON com TODOS os movimentos:
[{"id":"<id do movimento>","categoria_id":"<id>"|null,"alternativas":["<id>"],"motivo":"<frase>"}]`;

export const SYSTEM_REVISAR = `Você é um contador brasileiro REVISANDO a identificação de movimentações bancárias feita por outra pessoa. Seu trabalho é achar erros.

Você receberá o contexto da empresa e, para cada movimento, a conta proposta e o motivo.

${REGRAS}
- Concorde SOMENTE se a descrição e o contexto sustentam a conta proposta sem dúvida razoável. Palpite plausível não basta.
- Se discordar e souber a conta certa, informe-a em categoria_id; se não souber, null.

Responda SOMENTE um array JSON com TODOS os movimentos:
[{"id":"<id do movimento>","concorda":true|false,"categoria_id":"<id>"|null,"motivo":"<frase>"}]`;

export interface Classificacao {
  id: string;
  categoria_id: string | null;
  alternativas?: string[];
  motivo?: string;
}
export interface Revisao {
  id: string;
  concorda: boolean;
  categoria_id?: string | null;
  motivo?: string;
}

export interface ResultadoExtrato {
  analisados: number;
  identificados: number;
  /** Viraram pergunta ao empresário. */
  paraRevisao: number;
  descartados: { id: string; motivo: string }[];
  erros: string[];
  disponivel: boolean;
}

export interface Conta {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'INCOME' | 'EXPENSE' | 'AMBOS';
}

/** Movimentos por chamada à IA: cabe folgado na resposta e o erro de um lote não derruba os outros. */
const LOTE_DA_IA = 40;

/**
 * Identifica TODA a fila da transitória, em lotes. Um extrato de quatro meses
 * tem 80+ movimentos; com um lote só, os mais antigos ficavam para "a próxima
 * vez" e o mês não fechava (visto na Gateway, 28/09/2026). Com `limite`, roda
 * um lote só — é o que o cron usa para dividir a cota.
 */
export async function identificarMovimentos(companyId: string, opts: { limite?: number } = {}): Promise<ResultadoExtrato> {
  if (opts.limite) return identificarLote(companyId, opts.limite);
  const total: ResultadoExtrato = { analisados: 0, identificados: 0, paraRevisao: 0, descartados: [], erros: [], disponivel: true };
  for (let rodada = 0; rodada < 10; rodada++) {
    const r = await identificarLote(companyId, LOTE_DA_IA);
    total.analisados += r.analisados;
    total.identificados += r.identificados;
    total.paraRevisao += r.paraRevisao;
    total.descartados.push(...r.descartados);
    total.erros.push(...r.erros);
    total.disponivel &&= r.disponivel;
    if (r.analisados === 0 || r.erros.length || !r.disponivel) break;
  }
  return total;
}

async function identificarLote(companyId: string, limite: number): Promise<ResultadoExtrato> {
  const vazio: ResultadoExtrato = { analisados: 0, identificados: 0, paraRevisao: 0, descartados: [], erros: [], disponivel: true };
  const db = getDb();

  // Só o que ainda não virou pergunta — não se pergunta à IA de novo o que já está com o empresário.
  const naFila = await movimentosNaTransitoria(db, companyId, 2000);
  const jaPerguntados = new Set(
    (
      (await db.execute(sql`
        SELECT bank_transaction_id::text AS id FROM pergunta_de_classificacao WHERE company_id = ${companyId}
      `)) as unknown as { id: string }[]
    ).map((r) => r.id),
  );
  // Limita DEPOIS de tirar os já perguntados: senão um lote cheio deles volta vazio e a fila para.
  let movimentos = naFila.filter((m) => !jaPerguntados.has(m.bankTransactionId)).slice(0, limite);
  if (!movimentos.length) return vazio;

  // Empresa cadastrada sem o plano de categorias: sem ele não há onde classificar.
  await garantirCategoriasPadrao(db, companyId);
  const categorias = (await db.execute(sql`
    SELECT id::text, name AS nome, kind AS tipo, accounting_code AS codigo
      FROM category WHERE company_id = ${companyId} AND accounting_code IS NOT NULL
  `)) as unknown as Conta[];
  const contas: Conta[] = [...categorias, ...ESPECIAIS.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome, tipo: e.tipo }))];
  const porId = new Map(contas.map((c) => [c.id, c]));
  const out: ResultadoExtrato = { ...vazio, analisados: movimentos.length };

  if (!categorias.length) {
    return { ...out, erros: ['Empresa sem categorias com código contábil.'] };
  }

  const combina = (valor: number, c: Conta | undefined) =>
    !!c && (c.tipo === 'AMBOS' || c.tipo === (valor < 0 ? 'EXPENSE' : 'INCOME'));

  /** As contas mais usadas em cada sentido — as opções quando ninguém sugeriu nada. */
  const maisUsadas = (await db.execute(sql`
    SELECT c.id::text, count(*)::int AS n, c.kind AS tipo
      FROM financial_entry e JOIN category c ON c.id = e.category_id
     WHERE e.company_id = ${companyId} AND c.accounting_code IS NOT NULL
     GROUP BY c.id, c.kind ORDER BY n DESC
  `)) as unknown as { id: string; tipo: string }[];

  const perguntar = async (
    m: (typeof movimentos)[number],
    sugeridas: { id: string | null | undefined; motivo?: string }[],
  ) => {
    const opcoes: { conta: string; nome: string; motivo: string | null }[] = [];
    for (const s of sugeridas) {
      const c = s.id ? porId.get(s.id) : undefined;
      if (!combina(m.valor, c) || opcoes.some((o) => o.conta === c!.codigo)) continue;
      opcoes.push({ conta: c!.codigo, nome: c!.nome, motivo: s.motivo ?? null });
    }
    for (const u of maisUsadas) {
      if (opcoes.length >= 3) break;
      const c = porId.get(u.id);
      if (!combina(m.valor, c) || opcoes.some((o) => o.conta === c!.codigo)) continue;
      opcoes.push({ conta: c!.codigo, nome: c!.nome, motivo: null });
    }
    await db.execute(sql`
      INSERT INTO pergunta_de_classificacao (company_id, bank_transaction_id, data, valor, descricao, opcoes, revisar_contador)
      VALUES (${companyId}, ${m.bankTransactionId}, ${m.data}::date, ${m.valor}, ${m.descricao},
              ${JSON.stringify(opcoes.slice(0, 3))}::jsonb, ${Math.abs(m.valor) > LIMITE_AUTOMATICO})
      ON CONFLICT (bank_transaction_id) DO NOTHING
    `);
    out.paraRevisao++;
  };

  // ── Regra: saída para sócio (nome ou CPF) é distribuição de lucro ──────────
  // Fato do cadastro, não palpite: não passa pela IA nem vira pergunta.
  // A importação já aplica; aqui pega o que entrou antes da regra existir.
  {
    const restantes: typeof movimentos = [];
    for (const m of movimentos) {
      if (!(await saidaParaSocio(db, companyId, m.descricao, m.valor))) { restantes.push(m); continue; }
      const r = await reclassificarMovimento(db, companyId, m.bankTransactionId, ACCOUNTS.LUCROS_A_PAGAR, 'Saída para sócio: distribuição de lucros');
      if (r.ok) out.identificados++;
      else restantes.push(m);
    }
    movimentos = restantes;
  }

  // ── Jev: o motor LANÇA TUDO ───────────────────────────────────────────────
  // Decisão do Filipe (28/09/2026): perguntar tudo que não é certeza não serve
  // para 150 empresas. Com confiança, lança o que o Jev escolheu; sem ela, lança
  // no padrão óbvio (entrada de terceiro = receita de serviço; saída =
  // serviço contratado) e manda para a revisão do contador, SEM travar o mês.
  // A confiança só decide aqui; nunca vai para a tela.
  if (movimentos.length && (await jevDisponivel())) {
    const contextoJev = await contextoDaEmpresa(companyId, contas);
    const decisoes = new Map<string, EscolhaDoJev>();
    await Promise.all(
      movimentos.map(async (m) => {
        // Sem "transferência entre contas próprias": era o pior palpite do Jev na
        // dúvida (Pix a terceiros), e o razão recusa sem a conta de destino.
        const opcoes = Object.fromEntries(
          contas.filter((c) => combina(m.valor, c) && c.id !== 'ESPECIAL:TRANSFERENCIA').map((c) => [c.id, c.nome]),
        );
        const j = await escolherComJev(
          {
            empresa: contextoJev,
            movimento: {
              data: m.data,
              sentido: m.valor < 0 ? 'SAÍDA de dinheiro (pagamento)' : 'ENTRADA de dinheiro (recebimento)',
              valor_reais: Math.abs(m.valor),
              historico_do_banco: m.descricao,
            },
          },
          'Em qual conta contábil (plano de contas brasileiro, ITG 1000) este movimento bancário da empresa deve ser lançado? Use o histórico do banco e quem é a outra parte (sócio, cliente, fornecedor, órgão público).',
          opcoes,
        );
        if (j) decisoes.set(m.bankTransactionId, j);
      }),
    );
    // Aplicar em sequência: cada reclassificação estorna e lança no razão.
    const resultadoJev: Record<string, string> = {};
    for (const m of movimentos) {
      const j = decisoes.get(m.bankTransactionId);
      if (!j) continue;
      const segura = j.confianca >= CONFIANCA_PARA_LANCAR;
      const codigo = segura ? porId.get(j.escolha)!.codigo : m.valor > 0 ? CONTA_PADRAO_ENTRADA : CONTA_PADRAO_SAIDA;
      const nome = segura ? porId.get(j.escolha)!.nome : contas.find((c) => c.codigo === codigo)?.nome ?? codigo;
      const ok = await reclassificarMovimento(
        db, companyId, m.bankTransactionId, codigo,
        segura ? `Identificado pela IA como "${nome}"` : `Lançado no padrão "${nome}" — para revisão do contador`,
      );
      if (!ok.ok) {
        out.descartados.push({ id: m.bankTransactionId, motivo: ok.erro ?? 'falha ao reclassificar' });
        await perguntar(m, j.ranking.slice(0, 3).map((id) => ({ id })));
        continue;
      }
      out.identificados++;
      resultadoJev[m.bankTransactionId] = `${segura ? 'aplicado' : 'padrao'}:${codigo}`;
      // Só aprende o que foi decidido com confiança — o padrão não é conhecimento.
      if (segura) await aprender(db, companyId, { descricao: m.descricao, valor: m.valor, conta: codigo, categoriaNome: nome, origem: 'IA_VERIFICADA' });
      // Sem confiança ou valor alto: lançado, e na fila de revisão do contador.
      if (!segura || Math.abs(m.valor) > LIMITE_AUTOMATICO) {
        const alternativas = j.ranking.slice(0, 3).map((id) => porId.get(id)).filter(Boolean).map((c) => ({ conta: c!.codigo, nome: c!.nome, motivo: null }));
        await db.execute(sql`
          INSERT INTO pergunta_de_classificacao (company_id, bank_transaction_id, data, valor, descricao, opcoes, revisar_contador, status, resposta_conta, respondida_por, respondido_em)
          VALUES (${companyId}, ${m.bankTransactionId}, ${m.data}::date, ${m.valor}, ${m.descricao}, ${JSON.stringify(alternativas)}::jsonb, true, 'RESPONDIDA', ${codigo}, 'MOTOR', now())
          ON CONFLICT (bank_transaction_id) DO NOTHING
        `);
      }
    }
    await registrar(companyId, 'CONCILIACAO_JEV', process.env.JEV_MODEL || 'jev-latest', { movimentos: movimentos.length }, Object.fromEntries(decisoes), resultadoJev, null);
    // O que o Jev não respondeu (falha, fora do ar) segue para a reserva abaixo.
    movimentos = movimentos.filter((m) => !decisoes.has(m.bankTransactionId));
  }
  if (!movimentos.length) return out;

  const creds = await resolveCredentials();
  if (!creds) {
    // Sem IA configurada, nada fica parado sem dono: tudo vira pergunta.
    for (const m of movimentos) await perguntar(m, []);
    return { ...out, disponivel: false };
  }

  const contexto = await contextoDaEmpresa(companyId, contas);
  const lista = movimentos.map((m) => `${m.bankTransactionId} | ${m.data} | R$ ${m.valor.toFixed(2)} | ${m.descricao}`).join('\n');
  const motor = await resolverMotor(creds, 'conciliacao');

  // ── 1ª passada: classificar ───────────────────────────────────────────────
  const c1 = await chamar<Classificacao[]>(motor, SYSTEM_CLASSIFICAR, `${contexto}\n\nMOVIMENTOS A IDENTIFICAR:\n${lista}`);
  if (!c1.ok) {
    // Registra a falha: sem isso o extrato vira pergunta sem sugestão e ninguém sabe por quê.
    await registrar(companyId, 'CLASSIFICAR_LANCAMENTOS', motor.model, { movimentos: movimentos.length }, { erro: c1.erro }, { falhou: true }, c1);
    for (const m of movimentos) await perguntar(m, []);
    return { ...out, erros: [c1.erro] };
  }
  const classif = new Map((Array.isArray(c1.dados) ? c1.dados : []).filter((c) => c && typeof c.id === 'string').map((c) => [c.id, c]));

  // ── 2ª passada: revisar o que foi proposto ────────────────────────────────
  const propostos = movimentos
    .map((m) => ({ m, c: classif.get(m.bankTransactionId) }))
    .filter((x) => x.c?.categoria_id && combina(x.m.valor, porId.get(x.c.categoria_id)));
  let revisoes = new Map<string, Revisao>();
  let r2: Awaited<ReturnType<typeof chamar<Revisao[]>>> | null = null;
  if (propostos.length) {
    const aRevisar = propostos
      .map(({ m, c }) => {
        const conta = porId.get(c!.categoria_id!)!;
        return `${m.bankTransactionId} | ${m.data} | R$ ${m.valor.toFixed(2)} | ${m.descricao} → PROPOSTA: ${conta.id} (${conta.nome}) · motivo: ${c!.motivo ?? '—'}`;
      })
      .join('\n');
    r2 = await chamar<Revisao[]>(motor, SYSTEM_REVISAR, `${contexto}\n\nIDENTIFICAÇÕES A REVISAR:\n${aRevisar}`);
    if (r2.ok) revisoes = new Map((Array.isArray(r2.dados) ? r2.dados : []).filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r]));
  }

  // ── Decidir cada movimento ────────────────────────────────────────────────
  const resultado: Record<string, string> = {};
  for (const m of movimentos) {
    const c = classif.get(m.bankTransactionId);
    const r = revisoes.get(m.bankTransactionId);
    const proposta = c?.categoria_id ? porId.get(c.categoria_id) : undefined;
    const verificada = !!proposta && combina(m.valor, proposta) && r?.concorda === true;

    if (verificada && Math.abs(m.valor) <= LIMITE_AUTOMATICO) {
      const motivo = c!.motivo ? `: ${c!.motivo.slice(0, 140)}` : '';
      const ok = await reclassificarMovimento(db, companyId, m.bankTransactionId, proposta!.codigo, `Identificado pela IA e conferido como "${proposta!.nome}"${motivo}`);
      if (ok.ok) {
        await aprender(db, companyId, { descricao: m.descricao, valor: m.valor, conta: proposta!.codigo, categoriaNome: proposta!.nome, origem: 'IA_VERIFICADA' });
        out.identificados++;
        resultado[m.bankTransactionId] = `aplicado:${proposta!.codigo}`;
        continue;
      }
      out.descartados.push({ id: m.bankTransactionId, motivo: ok.erro ?? 'falha ao reclassificar' });
    }

    // Qualquer dúvida vira pergunta, com o que as duas passadas sugeriram primeiro.
    await perguntar(m, [
      { id: c?.categoria_id, motivo: c?.motivo },
      { id: r && !r.concorda ? r.categoria_id : undefined, motivo: r?.motivo },
      ...(c?.alternativas ?? []).map((id) => ({ id })),
    ]);
    resultado[m.bankTransactionId] = verificada ? 'pergunta:valor_alto' : r && !r.concorda ? 'pergunta:revisor_discordou' : 'pergunta:sem_base';
  }

  await registrar(companyId, 'CONCILIACAO', motor.model, { movimentos: movimentos.length }, { classificacao: c1.dados, revisao: r2?.ok ? r2.dados : null }, resultado, c1, r2);
  return out;
}

/** O que o modelo precisa saber da empresa para identificar sem chutar. */
export async function contextoDaEmpresa(companyId: string, contas: Conta[]): Promise<string> {
  const db = getDb();
  const q = <T,>(p: Promise<unknown>) => (p as Promise<T>).catch(() => [] as unknown as T);
  const [empresa, socios, pessoas, clientes, fornecedores, bancos, abertos, exemplos] = await Promise.all([
    q<{ nome: string; cnpj: string; atividade: string | null; descricao: string | null }[]>(
      db.execute(sql`SELECT coalesce(trade_name, legal_name) AS nome, cnpj, main_activity_text AS atividade, activity_description AS descricao FROM company WHERE id = ${companyId}`),
    ),
    q<{ nome: string; cpf: string | null }[]>(db.execute(sql`SELECT name AS nome, cpf FROM partner WHERE company_id = ${companyId}`)),
    q<{ nome: string }[]>(db.execute(sql`SELECT name AS nome FROM employee WHERE company_id = ${companyId} AND status <> 'DESLIGADO' LIMIT 40`)),
    q<{ nome: string; doc: string | null }[]>(db.execute(sql`SELECT name AS nome, document AS doc FROM customer WHERE company_id = ${companyId} ORDER BY created_at DESC LIMIT 80`)),
    q<{ nome: string; cnpj: string | null }[]>(
      db.execute(sql`
        SELECT max(prestador_nome) AS nome, prestador_cnpj AS cnpj FROM nfse_distribuicao_doc
         WHERE company_id = ${companyId} AND direction = 'RECEBIDA' AND prestador_cnpj IS NOT NULL
         GROUP BY prestador_cnpj ORDER BY max(data_emissao) DESC LIMIT 60`),
    ),
    q<{ banco: string; numero: string | null }[]>(db.execute(sql`SELECT bank_name AS banco, number AS numero FROM bank_account WHERE company_id = ${companyId}`)),
    q<{ tipo: string; descricao: string; valor: number; venc: string }[]>(
      db.execute(sql`
        SELECT type AS tipo, description AS descricao, amount::float AS valor, to_char(due_date, 'YYYY-MM-DD') AS venc
          FROM financial_entry WHERE company_id = ${companyId} AND status IN ('PENDING', 'OVERDUE')
         ORDER BY due_date DESC LIMIT 60`),
    ),
    exemplosDoConhecimento(db, companyId, 40).catch(() => []),
  ]);
  const e = empresa[0];
  const linhas = (titulo: string, itens: string[]) => (itens.length ? `\n${titulo}:\n${itens.join('\n')}` : '');
  return [
    `EMPRESA: ${e?.nome ?? '—'} (CNPJ ${e?.cnpj ?? '—'}) — prestadora de serviços. Atividade: ${e?.atividade ?? '—'}${e?.descricao ? `. ${e.descricao}` : ''}`,
    linhas('CONTAS DISPONÍVEIS (id | tipo | código | nome)', contas.map((c) => `${c.id} | ${c.tipo} | ${c.codigo} | ${c.nome}`)),
    linhas('SÓCIOS', socios.map((s) => `${s.nome}${s.cpf ? ` (CPF ${s.cpf})` : ''}`)),
    linhas('FUNCIONÁRIOS', pessoas.map((p) => p.nome)),
    linhas('CLIENTES', clientes.map((c) => `${c.nome}${c.doc ? ` (${c.doc})` : ''}`)),
    linhas('FORNECEDORES (das notas recebidas)', fornecedores.map((f) => `${f.nome} (CNPJ ${f.cnpj})`)),
    linhas('CONTAS BANCÁRIAS PRÓPRIAS', bancos.map((b) => `${b.banco}${b.numero ? ` ${b.numero}` : ''}`)),
    linhas('LANÇAMENTOS EM ABERTO (tipo | vencimento | valor | descrição)', abertos.map((a) => `${a.tipo} | ${a.venc} | R$ ${a.valor.toFixed(2)} | ${a.descricao}`)),
    linhas(
      'JÁ ENSINADO (descrição → conta, quem ensinou)',
      exemplos.map((x) => `${x.exemplo} [${x.sentido}] → ${x.conta} ${x.nome ?? ''} (${x.origem})`),
    ),
  ].join('\n');
}

export async function chamar<T>(motor: LlmConfig, system: string, user: string, forma: 'array' | 'objeto' = 'array') {
  try {
    // 60 movimentos com motivo, mais o raciocínio do modelo (que conta como saída), estouram 8 mil
    // tokens e o JSON chega cortado — medido na Gateway em 28/09/2026. Só se paga o que sai.
    const r = await callLlmJson<T>(motor, { system, user, maxTokens: 32000, temperature: 0 }, forma);
    if (!r.dados) return { ok: false as const, erro: `Resposta do modelo sem JSON válido: ${r.texto.slice(0, 200)}`, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
    return { ok: true as const, dados: r.dados, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
  } catch (err) {
    return { ok: false as const, erro: err instanceof Error ? err.message : String(err), tokensIn: null, tokensOut: null };
  }
}

export async function registrar(
  companyId: string,
  tarefa: string,
  modelo: string,
  entrada: unknown,
  saida: unknown,
  resultado: unknown,
  ...chamadas: ({ tokensIn: number | null; tokensOut: number | null } | null)[]
) {
  const tIn = chamadas.reduce((s, c) => s + (c?.tokensIn ?? 0), 0);
  const tOut = chamadas.reduce((s, c) => s + (c?.tokensOut ?? 0), 0);
  await getDb()
    .execute(sql`
      INSERT INTO registro_da_ia (company_id, tarefa, modelo, entrada, saida, resultado, tokens_in, tokens_out)
      VALUES (${companyId}, ${tarefa}, ${modelo}, ${JSON.stringify(entrada)}::jsonb, ${JSON.stringify(saida)}::jsonb,
              ${JSON.stringify(resultado)}::jsonb, ${tIn}, ${tOut})
    `)
    .catch((e) => console.error('[agente-extrato] registro', e));
}

/**
 * Responde uma pergunta: tira o movimento da transitória, põe na conta
 * escolhida e ensina a base. Depois, as outras perguntas abertas que a base
 * agora sabe responder se resolvem sozinhas.
 */
export async function responderPergunta(
  companyId: string,
  perguntaId: string,
  conta: string,
  quem: 'EMPRESARIO' | 'CONTADOR',
): Promise<{ ok: boolean; erro?: string; resolvidasJuntas: number }> {
  const db = getDb();
  const [p] = (await db.execute(sql`
    SELECT id::text, bank_transaction_id::text AS tx, valor::float, descricao, status, revisar_contador
      FROM pergunta_de_classificacao WHERE id = ${perguntaId} AND company_id = ${companyId}
  `)) as unknown as { id: string; tx: string; valor: number; descricao: string; status: string; revisar_contador: boolean }[];
  if (!p) return { ok: false, erro: 'Pergunta não encontrada.', resolvidasJuntas: 0 };

  const nome = await nomeDaConta(companyId, conta);
  if (p.status === 'ABERTA') {
    const r = await reclassificarMovimento(db, companyId, p.tx, conta, `Identificado por ${quem === 'CONTADOR' ? 'contador' : 'empresário'} como "${nome ?? conta}"`);
    if (!r.ok) return { ok: false, erro: r.erro, resolvidasJuntas: 0 };
  } else {
    // Já respondida (o contador revendo a do empresário): se mudou a conta, corrige por estorno.
    const [atual] = (await db.execute(sql`SELECT resposta_conta FROM pergunta_de_classificacao WHERE id = ${perguntaId}`)) as unknown as { resposta_conta: string | null }[];
    if (atual?.resposta_conta && atual.resposta_conta !== conta) {
      // `reclassificarMovimento` estorna a partida em vigor e lança de novo — serve para corrigir também.
      const r = await reclassificarMovimento(db, companyId, p.tx, conta, `Corrigido pelo contador para "${nome ?? conta}"`);
      if (!r.ok) return { ok: false, erro: r.erro, resolvidasJuntas: 0 };
    }
  }

  await db.execute(sql`
    UPDATE pergunta_de_classificacao
       SET status = 'RESPONDIDA', resposta_conta = ${conta},
           respondida_por = CASE WHEN respondida_por IS NULL OR ${quem} = 'CONTADOR' THEN ${quem} ELSE respondida_por END,
           respondido_em = coalesce(respondido_em, now()),
           revisado_em = CASE WHEN ${quem} = 'CONTADOR' THEN now() ELSE revisado_em END
     WHERE id = ${perguntaId}
  `);
  await aprender(db, companyId, { descricao: p.descricao, valor: p.valor, conta, categoriaNome: nome, origem: quem });

  // O que a base agora sabe responder, responde.
  let juntas = 0;
  const abertas = (await db.execute(sql`
    SELECT id::text, bank_transaction_id::text AS tx, valor::float, descricao, revisar_contador
      FROM pergunta_de_classificacao WHERE company_id = ${companyId} AND status = 'ABERTA' AND id <> ${perguntaId}
  `)) as unknown as { id: string; tx: string; valor: number; descricao: string; revisar_contador: boolean }[];
  for (const a of abertas) {
    const k = await consultarConhecimento(db, companyId, a.descricao, a.valor);
    if (!k || (k.origem !== 'EMPRESARIO' && k.origem !== 'CONTADOR')) continue;
    const r = await reclassificarMovimento(db, companyId, a.tx, k.conta, `Identificado pelo que ${k.origem === 'CONTADOR' ? 'o contador' : 'o empresário'} já ensinou: "${k.nome ?? k.conta}"`);
    if (!r.ok) continue;
    await db.execute(sql`
      UPDATE pergunta_de_classificacao
         SET status = 'RESPONDIDA', resposta_conta = ${k.conta}, respondida_por = 'CONHECIMENTO', respondido_em = now()
       WHERE id = ${a.id}
    `);
    juntas++;
  }
  return { ok: true, resolvidasJuntas: juntas };
}

async function nomeDaConta(companyId: string, conta: string): Promise<string | null> {
  const especial = ESPECIAIS.find((e) => e.codigo === conta);
  if (especial) return especial.nome;
  const [c] = (await getDb().execute(sql`
    SELECT name FROM category WHERE company_id = ${companyId} AND accounting_code = ${conta} LIMIT 1
  `)) as unknown as { name: string }[];
  return c?.name ?? null;
}

// ── O que a tela mostra ──────────────────────────────────────────────────────

export interface PerguntaAberta {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  opcoes: { conta: string; nome: string; motivo: string | null }[];
  revisarContador: boolean;
}

export async function perguntasAbertas(companyId: string): Promise<PerguntaAberta[]> {
  return (await getDb().execute(sql`
    SELECT id::text, to_char(data, 'YYYY-MM-DD') AS data, valor::float, descricao, opcoes, revisar_contador AS "revisarContador"
      FROM pergunta_de_classificacao
     WHERE company_id = ${companyId} AND status = 'ABERTA'
     ORDER BY abs(valor) DESC, data DESC
  `)) as unknown as PerguntaAberta[];
}

/** Respondidas pelo empresário com valor alto, esperando a conferência do contador. */
export async function perguntasParaOContador(companyId: string): Promise<(PerguntaAberta & { resposta: string; respostaNome: string | null })[]> {
  return (await getDb().execute(sql`
    SELECT p.id::text, to_char(p.data, 'YYYY-MM-DD') AS data, p.valor::float, p.descricao, p.opcoes,
           p.revisar_contador AS "revisarContador", p.resposta_conta AS resposta,
           (SELECT name FROM category c WHERE c.company_id = p.company_id AND c.accounting_code = p.resposta_conta LIMIT 1) AS "respostaNome"
      FROM pergunta_de_classificacao p
     WHERE p.company_id = ${companyId} AND p.status = 'RESPONDIDA' AND p.revisar_contador AND p.revisado_em IS NULL
     ORDER BY abs(p.valor) DESC
  `)) as unknown as (PerguntaAberta & { resposta: string; respostaNome: string | null })[];
}

/** Todas as contas que podem responder uma pergunta — o "outra conta" da tela. */
export async function contasParaResponder(companyId: string): Promise<{ conta: string; nome: string; tipo: 'INCOME' | 'EXPENSE' | 'AMBOS' }[]> {
  const cats = (await getDb().execute(sql`
    SELECT DISTINCT ON (accounting_code) accounting_code AS conta, name AS nome, kind AS tipo
      FROM category WHERE company_id = ${companyId} AND accounting_code IS NOT NULL
     ORDER BY accounting_code, name
  `)) as unknown as { conta: string; nome: string; tipo: 'INCOME' | 'EXPENSE' }[];
  // Sem transferência entre contas próprias: lançada contra o mesmo banco não
  // move nada (o razão recusa). Volta quando houver a conta de destino.
  return [
    ...cats.sort((a, b) => a.nome.localeCompare(b.nome)),
    ...ESPECIAIS.filter((e) => e.id !== 'ESPECIAL:TRANSFERENCIA').map((e) => ({ conta: e.codigo, nome: e.nome, tipo: e.tipo })),
  ];
}

export interface MovimentoAmbiguo {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  candidatos: { id: string; descricao: string; valor: number; vencimento: string }[];
}

/** Movimentos com mais de um lançamento possível — a pergunta é "qual destes foi?". */
export async function movimentosAmbiguos(companyId: string): Promise<MovimentoAmbiguo[]> {
  const db = getDb();
  const txs = (await db.execute(sql`
    SELECT id::text, to_char(posted_at, 'YYYY-MM-DD') AS data, amount::float AS valor, description AS descricao
      FROM bank_transaction WHERE company_id = ${companyId} AND reconciliation_status = 'UNMATCHED'
     ORDER BY posted_at DESC LIMIT 50
  `)) as unknown as Omit<MovimentoAmbiguo, 'candidatos'>[];
  const out: MovimentoAmbiguo[] = [];
  for (const t of txs) {
    const candidatos = (await db.execute(sql`
      SELECT id::text, coalesce(description, '') AS descricao, amount::float AS valor, to_char(due_date, 'YYYY-MM-DD') AS vencimento
        FROM financial_entry
       WHERE company_id = ${companyId} AND type = ${t.valor > 0 ? 'RECEIVABLE' : 'PAYABLE'} AND status <> 'PAID'
         AND abs(amount::numeric - ${Math.abs(t.valor).toFixed(2)}::numeric) < 0.01
       ORDER BY abs(due_date - ${t.data}::date) LIMIT 5
    `)) as unknown as MovimentoAmbiguo['candidatos'];
    out.push({ ...t, candidatos });
  }
  return out;
}

export interface PerguntaDoEscritorio extends PerguntaAberta {
  companyId: string;
  empresa: string;
  status: 'ABERTA' | 'RESPONDIDA';
  resposta: string | null;
  respostaNome: string | null;
}

/**
 * A fila do contador, de todos os clientes: as perguntas ainda abertas e as
 * de valor alto que o empresário respondeu e esperam conferência.
 */
export async function perguntasDoEscritorio(): Promise<{ perguntas: PerguntaDoEscritorio[]; contas: Record<string, Awaited<ReturnType<typeof contasParaResponder>>> }> {
  const perguntas = (await getDb().execute(sql`
    SELECT p.id::text, p.company_id::text AS "companyId", coalesce(c.trade_name, c.legal_name) AS empresa,
           to_char(p.data, 'YYYY-MM-DD') AS data, p.valor::float, p.descricao, p.opcoes, p.status,
           p.revisar_contador AS "revisarContador", p.resposta_conta AS resposta,
           (SELECT name FROM category k WHERE k.company_id = p.company_id AND k.accounting_code = p.resposta_conta LIMIT 1) AS "respostaNome"
      FROM pergunta_de_classificacao p JOIN company c ON c.id = p.company_id
     WHERE p.status = 'ABERTA' OR (p.revisar_contador AND p.revisado_em IS NULL AND p.respondida_por = 'EMPRESARIO')
     ORDER BY (p.status = 'RESPONDIDA') DESC, abs(p.valor) DESC
     LIMIT 300
  `)) as unknown as PerguntaDoEscritorio[];
  const empresas = [...new Set(perguntas.map((p) => p.companyId))];
  const contas: Record<string, Awaited<ReturnType<typeof contasParaResponder>>> = {};
  for (const id of empresas) contas[id] = await contasParaResponder(id);
  return { perguntas, contas };
}
