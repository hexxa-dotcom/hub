import 'server-only';
import {
  getDb,
  sql,
  COTA_DIARIA,
  ORIGEM_ONEFLOW,
  PARADA_NO_ENVIO,
  MAXIMO_DE_TENTATIVAS,
  FOLGA_DA_COTA,
  reservaParaAsDeCima,
  type RotinaDoOneflow,
} from '@hexxa/db';

/**
 * SAÚDE DA INTEGRAÇÃO COM O ONEFLOW — o que a tela do escritório mostra.
 *
 * Tudo que antes só aparecia num log que ninguém lê: quanto da cota de 500
 * chamadas já foi gasto e por quem, se as rotinas rodaram e deram certo, se
 * o acesso (token) está vivo, o que falhou no envio dos lançamentos e o que
 * ainda falta voltar de cada empresa. E, no topo, os PROBLEMAS — cada um com
 * o que fazer —, que viram o número vermelho no menu.
 */

/** 20% da cota fica sempre livre para sobrecarga (decisão de 28/09/2026). */
export const RESERVA = FOLGA_DA_COTA;

/** As rotinas que falam com o OneFlow, na ordem de prioridade da cota. */
export const ROTINAS_ONEFLOW: { caminho: string; chave: RotinaDoOneflow; nome: string; turno: string; papel: string }[] = [
  {
    caminho: 'retorno-oneflow',
    chave: 'retorno',
    nome: 'Guias e folha ← OneFlow',
    turno: 'meia-noite e manhã (2×)',
    papel: 'Traz DAS, DCTFWeb, FGTS e a folha para a área do cliente.',
  },
  {
    caminho: 'envio-nfse-oneflow',
    chave: 'nfse',
    nome: 'Notas fiscais → OneFlow',
    turno: 'meia-noite',
    papel: 'Manda as notas do mês que fechou para o fiscal de lá (dias 1 a 5).',
  },
  {
    caminho: 'envio-oneflow',
    chave: 'envio',
    nome: 'Lançamentos → OneFlow',
    turno: 'meia-noite (2×)',
    papel: 'Manda os lançamentos dos meses liberados, em lotes compostos por dia.',
  },
  {
    caminho: 'resultado-oneflow',
    chave: 'resultado',
    nome: 'Resultado oficial ← OneFlow',
    turno: 'manhã',
    papel: 'Lê o balancete de lá para mostrar o lucro oficial.',
  },
];

export interface EnvioIncerto {
  id: string;
  empresa: string;
  memo: string;
  data: string;
  documento: string;
  valor: number;
  erro: string | null;
}

export interface Problema {
  nivel: 'critico' | 'atencao';
  titulo: string;
  detalhe: string;
  /** O que fazer — em uma frase. */
  acao: string;
}

export interface SaudeOneflow {
  cota: { hoje: number; limite: number; reserva: number; media7: number; pico30: number; serie: { dia: string; chamadas: number }[] };
  token: { expiraEm: string | null; ultimoUso: string | null; temRenovacao: boolean; vivo: boolean };
  rotinas: {
    caminho: string;
    nome: string;
    turno: string;
    papel: string;
    ultima: { inicio: string; status: string; duracaoMs: number | null; chamadas: number | null; erro: string | null } | null;
    falhas7: number;
    mediaChamadas: number | null;
    /** Até quantas chamadas a rotina pode gastar hoje (prioridade e folga — cotaParaRotina). */
    tetoHoje: number;
  }[];
  envio: {
    enviados: number;
    erros: number;
    retirados: number;
    pendentesLiberados: number;
    errosPorMotivo: { empresa: string; motivo: string; qtd: number }[];
    /** Talvez estejam lá — o escritório confere e decide. */
    incertos: EnvioIncerto[];
    /** Recusadas no máximo de tentativas, por empresa. */
    esgotadas: { companyId: string; empresa: string; partidas: number }[];
  };
  volta: { competencia: string; empresas: { nome: string; fiscalOk: boolean; folhaOk: boolean; folhaStatus: string | null }[] };
  problemas: Problema[];
}

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const competenciaAnterior = () => {
  const [a, m] = hojeSP().split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export async function saudeDoOneflow(): Promise<SaudeOneflow> {
  const db = getDb();
  const competencia = competenciaAnterior();
  // As empresas ligadas ao OneFlow são as que têm token de empresa — lidas
  // antes e sozinhas: consulta dentro de consulta, no meio das outras dez,
  // esgotava o pool de conexões e travava a página.
  const ids = (
    (await db.execute(sql`SELECT scope_key FROM oneflow_token WHERE scope = 'COMPANY' AND scope_key IS NOT NULL`)) as unknown as { scope_key: string }[]
  )
    .map((t) => t.scope_key)
    .filter((k) => /^[0-9a-f-]{36}$/i.test(k));

  // Uma consulta de cada vez, de propósito: dez em paralelo (mais as do menu)
  // esgotavam o pool pelo pooler do Supabase e a página travava.
  const lista: unknown[] = [];
  for (const consulta of [
    () =>
      db.execute(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS dia, coalesce(u.chamadas, 0)::int AS chamadas
        FROM generate_series((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 29, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, interval '1 day') d
        LEFT JOIN oneflow_uso_diario u ON u.dia = d::date
       ORDER BY 1`),
    () => db.execute(sql`SELECT expires_at, last_used_at, refresh_enc IS NOT NULL AS renova FROM oneflow_token WHERE scope = 'USER' LIMIT 1`),
    () =>
      db.execute(sql`
      SELECT DISTINCT ON (rotina) rotina, inicio, status, duracao_ms, chamadas, erro
        FROM rotina_execucao ORDER BY rotina, inicio DESC`),
    () =>
      db.execute(sql`
      SELECT rotina, count(*)::int AS n FROM rotina_execucao
       WHERE status = 'FALHOU' AND inicio > NOW() - interval '7 days' GROUP BY rotina`),
    () =>
      db.execute(sql`
      SELECT rotina, round(avg(chamadas))::int AS media FROM rotina_execucao
       WHERE chamadas IS NOT NULL AND status <> 'PULADA' AND inicio > NOW() - interval '30 days' GROUP BY rotina`),
    // Recusada conta por PARTIDA e só enquanto não foi resolvida (cada tentativa grava uma linha).
    () =>
      db.execute(sql`
      SELECT 'ERRO' AS status, count(DISTINCT e.journal_entry_id)::int AS n FROM oneflow_envio e
       WHERE e.status = 'ERRO' AND NOT EXISTS (SELECT 1 FROM oneflow_envio o WHERE o.journal_entry_id = e.journal_entry_id AND o.status IN ('ENVIADO', 'ENVIANDO', 'INCERTO'))
      UNION ALL
      SELECT status, count(*)::int FROM oneflow_envio WHERE status <> 'ERRO' GROUP BY status`),
    () =>
      db.execute(sql`
      SELECT coalesce(c.trade_name, c.legal_name) AS empresa, left(regexp_replace(regexp_replace(coalesce(e.erro, 'sem motivo'), '^\\[oneflow [^]]*\\] \\S+: ', ''), '\\s+', ' ', 'g'), 220) AS motivo, count(DISTINCT e.journal_entry_id)::int AS qtd
        FROM oneflow_envio e JOIN company c ON c.id = e.company_id
       WHERE e.status = 'ERRO' AND NOT EXISTS (SELECT 1 FROM oneflow_envio o WHERE o.journal_entry_id = e.journal_entry_id AND o.status IN ('ENVIADO', 'ENVIANDO', 'INCERTO'))
       GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 8`),
    () =>
      db.execute(sql`
      SELECT count(*)::int AS n
        FROM journal_entry j
        JOIN monthly_closure mc ON mc.company_id = j.company_id AND mc.reference_month = j.reference_month AND mc.send_authorized_at IS NOT NULL
       WHERE j.status = 'POSTED' AND j.reversed_by IS NULL AND j.source <> 'CLOSING' AND NOT ${ORIGEM_ONEFLOW}
         AND NOT ${PARADA_NO_ENVIO}`),
    () =>
      ids.length
        ? db.execute(sql`
          SELECT coalesce(nullif(c.trade_name, ''), c.legal_name) AS nome, coalesce(oc.fiscal_ok, false) AS "fiscalOk",
                 coalesce(oc.folha_ok, false) AS "folhaOk", oc.folha_status AS "folhaStatus"
            FROM company c
            LEFT JOIN oneflow_competencia oc ON oc.company_id = c.id AND oc.competencia = ${competencia}
           WHERE c.id IN (${sql.join(
             ids.map((i) => sql`${i}::uuid`),
             sql`, `,
           )}) AND c.closed_at IS NULL
           ORDER BY 1`)
        : Promise.resolve([]),
    () =>
      db.execute(sql`
      SELECT resumo FROM rotina_execucao WHERE rotina = 'retorno-oneflow' AND status = 'OK' ORDER BY inicio DESC LIMIT 1`),
    // Envios que talvez tenham entrado lá: INCERTO, ou ENVIANDO há mais de 15
    // minutos (a rotina morreu no meio). Nunca reenviados sozinhos.
    () =>
      db.execute(sql`
      SELECT e.id::text AS id, coalesce(nullif(c.trade_name, ''), c.legal_name) AS empresa, j.memo,
             to_char(j.entry_date, 'DD/MM/YYYY') AS data, 'HUB-' || left(j.id::text, 8) AS documento,
             (SELECT sum(l.amount) FROM ledger_line l WHERE l.journal_entry_id = j.id AND l.direction = 'DEBIT')::float AS valor,
             e.erro, e.enviado_em
        FROM oneflow_envio e
        JOIN journal_entry j ON j.id = e.journal_entry_id
        JOIN company c ON c.id = e.company_id
       WHERE e.status = 'INCERTO' OR (e.status = 'ENVIANDO' AND e.enviado_em < NOW() - interval '15 minutes')
       ORDER BY e.enviado_em DESC LIMIT 50`),
    // Recusadas no máximo de tentativas, por empresa: só voltam com "Tentar de novo".
    () =>
      db.execute(sql`
      SELECT e.company_id::text AS "companyId", coalesce(nullif(c.trade_name, ''), c.legal_name) AS empresa, count(DISTINCT e.journal_entry_id)::int AS partidas
        FROM oneflow_envio e JOIN company c ON c.id = e.company_id
       WHERE e.status = 'ERRO'
         AND NOT EXISTS (SELECT 1 FROM oneflow_envio o WHERE o.journal_entry_id = e.journal_entry_id AND o.status IN ('ENVIADO', 'ENVIANDO', 'INCERTO'))
         AND (SELECT count(*) FROM oneflow_envio x WHERE x.journal_entry_id = e.journal_entry_id AND x.status = 'ERRO') >= ${MAXIMO_DE_TENTATIVAS}
       GROUP BY 1, 2 ORDER BY 3 DESC`),
  ])
    lista.push(await consulta());
  const [serie, tokens, ultimas, falhas, medias, envio, errosMotivo, pendentes, volta, razao, incertos, esgotadas] = lista as unknown as [
    { dia: string; chamadas: number }[],
    { expires_at: Date | null; last_used_at: Date | null; renova: boolean }[],
    { rotina: string; inicio: Date; status: string; duracao_ms: number | null; chamadas: number | null; erro: string | null }[],
    { rotina: string; n: number }[],
    { rotina: string; media: number }[],
    { status: string; n: number }[],
    { empresa: string; motivo: string; qtd: number }[],
    { n: number }[],
    { nome: string; fiscalOk: boolean; folhaOk: boolean; folhaStatus: string | null }[],
    { resumo: { empresas?: { empresa: string; razaoFecha?: boolean; diferenca?: number }[] } | null }[],
    EnvioIncerto[],
    { companyId: string; empresa: string; partidas: number }[],
  ];

  const hoje = serie.at(-1)?.chamadas ?? 0;
  const ult7 = serie.slice(-7);
  const media7 = Math.round(ult7.reduce((s, d) => s + d.chamadas, 0) / Math.max(1, ult7.length));
  const pico30 = Math.max(0, ...serie.map((d) => d.chamadas));
  const t = tokens[0];
  const agora = Date.now();
  const tokenVivo = Boolean(
    t &&
    ((t.expires_at && new Date(t.expires_at).getTime() > agora) || (t.renova && t.last_used_at && agora - new Date(t.last_used_at).getTime() < 36 * 3600_000)),
  );
  const nEnvio = (s: string) => envio.find((e) => e.status === s)?.n ?? 0;

  const rotinas = ROTINAS_ONEFLOW.map((r) => {
    const u = ultimas.find((x) => x.rotina === r.caminho);
    return {
      ...r,
      ultima: u ? { inicio: new Date(u.inicio).toISOString(), status: u.status, duracaoMs: u.duracao_ms, chamadas: u.chamadas, erro: u.erro } : null,
      falhas7: falhas.find((f) => f.rotina === r.caminho)?.n ?? 0,
      tetoHoje: Math.max(0, COTA_DIARIA - FOLGA_DA_COTA - reservaParaAsDeCima(r.chave, Number(hojeSP().slice(8, 10)))),
      mediaChamadas: medias.find((m) => m.rotina === r.caminho)?.media ?? null,
    };
  });

  // ── Os problemas, do mais grave para o menos ─────────────────────────────
  const problemas: Problema[] = [];
  const util = COTA_DIARIA - RESERVA;
  if (!tokenVivo) {
    problemas.push({
      nivel: 'critico',
      titulo: 'Acesso ao OneFlow expirado',
      detalhe: 'O token de login do escritório não renovou. Sem ele, nada vai e nada volta — para todas as empresas.',
      acao: 'Fazer login de novo no OneFlow (app.omie.com.br) e registrar o token novo.',
    });
  }
  if (hoje >= COTA_DIARIA) {
    problemas.push({
      nivel: 'critico',
      titulo: 'Cota do OneFlow esgotada hoje',
      detalhe: `${hoje} de ${COTA_DIARIA} chamadas usadas. O resto fica para amanhã.`,
      acao: 'Nada a fazer agora: as rotinas retomam sozinhas após a meia-noite.',
    });
  } else if (hoje >= util) {
    problemas.push({
      nivel: 'atencao',
      titulo: 'A reserva da cota está sendo usada',
      detalhe: `${hoje} de ${COTA_DIARIA} chamadas hoje — acima dos ${util} planejados (20% é folga).`,
      acao: 'Ver abaixo qual rotina gastou mais; se repetir, é gargalo.',
    });
  }
  if (media7 >= util * 0.8) {
    problemas.push({
      nivel: 'atencao',
      titulo: 'Uso da cota perto do limite',
      detalhe: `Média de ${media7} chamadas por dia na última semana, para ${util} planejadas.`,
      acao: 'Hora de rever os turnos de envio ou falar com o OneFlow sobre a cota.',
    });
  }
  for (const r of rotinas) {
    if (!r.ultima) continue;
    if (r.ultima.status === 'FALHOU') {
      problemas.push({
        nivel: 'critico',
        titulo: `${r.nome}: a última execução falhou`,
        detalhe: (r.ultima.erro ?? 'sem mensagem').slice(0, 300),
        acao: 'Ver o erro abaixo; se for do OneFlow fora do ar, a próxima execução tenta de novo.',
      });
    }
    if (agora - new Date(r.ultima.inicio).getTime() > 36 * 3600_000) {
      problemas.push({
        nivel: 'critico',
        titulo: `${r.nome}: não roda há mais de 36 horas`,
        detalhe: `Última execução em ${new Date(r.ultima.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
        acao: 'Conferir os agendamentos (cron) da Vercel.',
      });
    }
  }
  if (incertos.length) {
    problemas.push({
      nivel: 'critico',
      titulo: `${incertos.length} ${incertos.length === 1 ? 'lançamento com envio incerto' : 'lançamentos com envio incerto'}`,
      detalhe: 'O OneFlow não respondeu (ou a rotina parou no meio). Eles podem ter entrado lá — por isso não são reenviados sozinhos.',
      acao: 'Procurar no OneFlow pelo documento HUB-… de cada um (lista abaixo) e marcar "Está no OneFlow" ou "Não está — reenviar".',
    });
  }
  if (esgotadas.length) {
    problemas.push({
      nivel: 'atencao',
      titulo: `Envio parado em ${esgotadas.map((e) => e.empresa).join(', ')}`,
      detalhe: `Lançamentos recusados ${MAXIMO_DE_TENTATIVAS} vezes pelo mesmo motivo — tentar de novo sem mudar nada só gastaria cota.`,
      acao: 'Corrigir a causa (motivos abaixo) e clicar em "Tentar de novo" na empresa.',
    });
  }
  if (nEnvio('ERRO') > 0 && !esgotadas.length) {
    problemas.push({
      nivel: 'atencao',
      titulo: `${nEnvio('ERRO')} lançamentos recusados pelo OneFlow`,
      detalhe: 'Ficaram parados e não vão sozinhos. Os motivos mais comuns estão abaixo.',
      acao: 'Corrigir a causa (quase sempre conta sem de-para) e liberar o reenvio.',
    });
  }
  const diaDoMes = Number(hojeSP().slice(8, 10));
  const incompletas = volta.filter((v) => !v.fiscalOk || !v.folhaOk);
  if (diaDoMes > 20 && incompletas.length) {
    problemas.push({
      nivel: 'atencao',
      titulo: `${incompletas.length} ${incompletas.length === 1 ? 'empresa' : 'empresas'} sem tudo de volta da competência`,
      detalhe: `Passou do dia 20 e ainda falta ${incompletas.map((v) => `${v.nome} (${!v.fiscalOk ? 'DAS' : 'folha'})`).join(', ')}.`,
      acao: 'Conferir no OneFlow se a apuração/folha foi fechada lá.',
    });
  }
  for (const e of razao[0]?.resumo?.empresas ?? []) {
    if (e.razaoFecha === false) {
      problemas.push({
        nivel: 'critico',
        titulo: `Razão não fecha: ${e.empresa}`,
        detalhe: `Depois de importar do OneFlow, sobrou diferença de ${e.diferenca ?? '?'} entre débito e crédito.`,
        acao: 'Abrir o razão da empresa e achar o lançamento desbalanceado.',
      });
    }
  }
  problemas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'critico' ? -1 : 1));

  return {
    cota: { hoje, limite: COTA_DIARIA, reserva: RESERVA, media7, pico30, serie },
    token: {
      expiraEm: t?.expires_at ? new Date(t.expires_at).toISOString() : null,
      ultimoUso: t?.last_used_at ? new Date(t.last_used_at).toISOString() : null,
      temRenovacao: Boolean(t?.renova),
      vivo: tokenVivo,
    },
    rotinas,
    envio: {
      enviados: nEnvio('ENVIADO'),
      erros: nEnvio('ERRO'),
      retirados: nEnvio('RETIRADO'),
      pendentesLiberados: pendentes[0]?.n ?? 0,
      errosPorMotivo: errosMotivo,
      incertos: incertos.map((i) => ({ ...i, valor: Number(i.valor ?? 0) })),
      esgotadas,
    },
    volta: { competencia, empresas: volta },
    problemas,
  };
}

/**
 * Só a contagem de problemas — para o número vermelho no menu do escritório.
 * Guardada por 1 minuto: o menu aparece em toda página do escritório, e
 * refazer as consultas a cada clique pesaria no banco à toa.
 */
let cache: { valor: number; em: number } | null = null;
export async function problemasDoOneflow(): Promise<number> {
  if (cache && Date.now() - cache.em < 60_000) return cache.valor;
  try {
    const valor = (await saudeDoOneflow()).problemas.length;
    cache = { valor, em: Date.now() };
    return valor;
  } catch {
    return cache?.valor ?? 0;
  }
}
