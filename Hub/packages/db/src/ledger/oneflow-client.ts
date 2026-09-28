import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';
import { OneflowAdapter, type OneflowTokenStore, type TokenDuplo } from '@hexxa/integrations';

/**
 * CLIENTE DO ONEFLOW LIGADO AO BANCO.
 *
 * O adaptador não conhece Postgres de propósito — recebe um store como
 * dependência. Este arquivo é a implementação desse store, e a fábrica que
 * entrega um cliente já autenticado.
 *
 * Existir como código de pacote, e não como script solto, é requisito da mão
 * de volta: quem traz folha e guias do OneFlow é um cron, e cron não pode
 * depender de um arquivo que alguém colou no /tmp uma vez.
 *
 * ── Sobre as colunas `_enc` ─────────────────────────────────────────────
 *
 * `token_enc` e `refresh_enc` guardam o valor como veio. O nome antecipa a
 * cifra em repouso, que ainda não existe em nenhum lugar deste repositório
 * (`api_key_encrypted` em `platform` e `ai` fazem o mesmo). Registrado aqui
 * para que ninguém leia o sufixo e conclua que já está protegido: a defesa
 * atual é a RLS `USING (false)`, que impede qualquer tenant de alcançar a
 * tabela, e não a criptografia.
 */
/**
 * Semente da cadeia, vinda do ambiente.
 *
 * O token do usuário é o único elo que não nasce de uma chamada de API: ele
 * vem de um login no navegador. `ONEFLOW_USER_TOKEN` e `ONEFLOW_USER_REFRESH`
 * carregam esse par inicial. Ele é lido apenas enquanto a tabela está vazia —
 * na primeira renovação o par novo é gravado no banco e passa a mandar, o que
 * evita o modo de falha de o ambiente ficar para sempre com um token morto.
 *
 * `expiresAt: null` faz o adaptador tratá-lo como expirado e renovar de
 * imediato: é o comportamento certo, porque não sabemos de quando ele é.
 */
function parDoAmbiente(): TokenDuplo | null {
  const token = process.env.ONEFLOW_USER_TOKEN;
  if (!token) return null;
  return {
    token,
    refreshToken: process.env.ONEFLOW_USER_REFRESH ?? null,
    expiresAt: null,
  };
}

export class PgOneflowTokenStore implements OneflowTokenStore {
  constructor(private readonly db: DbHandle) {}

  async ler(scope: 'USER' | 'APP' | 'COMPANY', scopeKey: string | null): Promise<TokenDuplo | null> {
    const linhas = (await this.db.execute(sql`
      SELECT token_enc, refresh_enc, expires_at
        FROM oneflow_token
       WHERE scope = ${scope}
         AND scope_key IS NOT DISTINCT FROM ${scopeKey}
       LIMIT 1
    `)) as unknown as { token_enc: string; refresh_enc: string | null; expires_at: Date | null }[];

    const t = linhas[0];
    if (!t) return scope === 'USER' ? parDoAmbiente() : null;
    return {
      token: t.token_enc,
      refreshToken: t.refresh_enc,
      expiresAt: t.expires_at ? new Date(t.expires_at) : null,
    };
  }

  async gravar(
    scope: 'USER' | 'APP' | 'COMPANY',
    scopeKey: string | null,
    appHash: string | null,
    t: TokenDuplo,
  ): Promise<void> {
    // Dois índices únicos parciais cobrem a tabela (um para USER, outro para
    // os escopos com chave), e ON CONFLICT só aceita um. Por isso o upsert é
    // feito à mão: apaga a linha do escopo e insere a nova.
    await this.db.execute(sql`
      DELETE FROM oneflow_token
       WHERE scope = ${scope} AND scope_key IS NOT DISTINCT FROM ${scopeKey}
    `);
    await this.db.execute(sql`
      INSERT INTO oneflow_token (scope, scope_key, app_hash, token_enc, refresh_enc, expires_at, last_used_at)
      VALUES (${scope}, ${scopeKey}, ${appHash}, ${t.token}, ${t.refreshToken},
              ${t.expiresAt ? t.expiresAt.toISOString() : null}::timestamptz, NOW())
    `);
  }
}

/**
 * Cliente autenticado, contando cada chamada na cota do dia.
 *
 * A contagem é do escritório inteiro porque a cota é: 500 por dia somando
 * todos os consumidores e todas as empresas. Sem contar num lugar só, cada
 * cron respeita o próprio orçamento e juntos estouram o total — que é
 * exatamente o que aconteceria com 50 empresas.
 */
export function clienteOneflow(db: DbHandle): OneflowAdapter {
  return new OneflowAdapter(new PgOneflowTokenStore(db), () => registrarChamada(db));
}

/** Dia corrente no fuso de São Paulo — é nele que a cota do OneFlow vira. */
const DIA_SP = sql`(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;

/**
 * Teto por minuto somando todos os processos. O OneFlow aceita 60; ficamos
 * em 55 para a latência não empurrar a 61ª para dentro do minuto errado.
 */
const TETO_POR_MINUTO = 55;

/**
 * Soma uma chamada ao contador do dia — e, antes, garante a vez no minuto.
 *
 * O espaçamento de 1,1s do adaptador vale dentro de UM processo; uma ação na
 * tela rodando junto com uma rotina somaria as duas. Aqui a conta é no banco,
 * para todo mundo: se o minuto já tem 55 chamadas, espera o próximo.
 */
async function registrarChamada(db: DbHandle): Promise<void> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const [m] = (await db.execute(sql`
      INSERT INTO oneflow_uso_minuto (minuto, chamadas) VALUES (date_trunc('minute', NOW()), 1)
      ON CONFLICT (minuto) DO UPDATE SET chamadas = oneflow_uso_minuto.chamadas + 1
      RETURNING chamadas, EXTRACT(SECOND FROM NOW())::float AS segundo
    `)) as unknown as { chamadas: number; segundo: number }[];
    if (!m || m.chamadas <= TETO_POR_MINUTO) break;
    // Passou do teto: devolve a vaga e espera virar o minuto.
    await db.execute(sql`UPDATE oneflow_uso_minuto SET chamadas = chamadas - 1 WHERE minuto = date_trunc('minute', NOW())`);
    await new Promise((r) => setTimeout(r, Math.max(500, (60 - m.segundo) * 1000 + 250)));
  }
  await db.execute(sql`
    INSERT INTO oneflow_uso_diario (dia, chamadas) VALUES (${DIA_SP}, 1)
    ON CONFLICT (dia) DO UPDATE
      SET chamadas = oneflow_uso_diario.chamadas + 1, atualizado_em = NOW()
  `);
  // Limpeza: minutos de ontem para trás não servem para nada.
  if (Math.random() < 0.02) await db.execute(sql`DELETE FROM oneflow_uso_minuto WHERE minuto < NOW() - interval '1 day'`);
}

/** Teto diário da API do OneFlow, para o escritório inteiro. */
export const COTA_DIARIA = 500;

/**
 * Quantas chamadas ainda cabem hoje.
 *
 * `reserva` é o que se quer deixar para os outros consumidores. O envio do
 * razão reserva espaço para a volta: a volta tem hora certa e não pode ser
 * adiada sem atrasar a guia do cliente, enquanto o envio retoma no dia
 * seguinte sem prejuízo nenhum.
 */
export async function cotaRestante(db: DbHandle, reserva = 0): Promise<number> {
  const [linha] = (await db.execute(sql`
    SELECT chamadas FROM oneflow_uso_diario WHERE dia = ${DIA_SP}
  `)) as unknown as { chamadas: number }[];
  const usadas = linha?.chamadas ?? 0;
  return Math.max(0, COTA_DIARIA - reserva - usadas);
}

/**
 * `app_hash` da empresa no OneFlow, casado pelo CNPJ.
 *
 * A Hexx identifica a empresa pelo seu próprio uuid; o OneFlow, por um hash
 * de app. O CNPJ é o único identificador que os dois lados compartilham, e
 * por isso é a junta. Devolve `null` quando a empresa não existe lá — é um
 * estado normal (cliente ainda não aberto no OneFlow), não um erro.
 */
export async function appHashPorCnpj(
  db: DbHandle,
  cnpj: string,
  companyId?: string,
): Promise<string | null> {
  // Já descoberto antes? A linha do token da empresa guarda o app_hash. Ler
  // daqui evita uma ida ao portal, que é o elo mais frágil da cadeia: ele
  // ficou fora do ar durante este desenvolvimento enquanto `rest.oneflow`
  // seguia respondendo normalmente, com os tokens já em cache.
  if (companyId) {
    const [t] = (await db.execute(sql`
      SELECT app_hash FROM oneflow_token
       WHERE scope = 'COMPANY' AND scope_key = ${companyId} AND app_hash IS NOT NULL
       LIMIT 1
    `)) as unknown as { app_hash: string }[];
    if (t?.app_hash) return t.app_hash;
  }

  const so = (v: string) => v.replace(/\D/g, '');
  const alvo = so(cnpj);
  const of = clienteOneflow(db);

  for (let pagina = 1; pagina <= 20; pagina++) {
    const empresas = await of.listarEmpresas(pagina);
    if (empresas.length === 0) return null;
    const achou = empresas.find((e) => so(String(e.cnpj ?? '')) === alvo);
    if (achou) return achou.appHash || null;
  }
  return null;
}

/**
 * Desde quando o contábil da empresa existe no OneFlow ('AAAA-MM'), ou `null`
 * se não foi implantado lá.
 *
 * Guardado por 7 dias em `oneflow_empresa`: o envio perguntava toda noite,
 * duas vezes, para cada empresa — com 150 empresas seriam 300 chamadas por
 * noite para ouvir a mesma resposta. Lança se o OneFlow não responder e não
 * houver valor guardado (seguir sem a data arriscaria recusas em lote).
 */
export async function inicioDoContabil(
  db: DbHandle,
  cliente: { competenciaInicialDosModulos: (c: string, a: string) => Promise<Record<string, string>> },
  companyId: string,
  appHash: string,
): Promise<string | null> {
  const [g] = (await db.execute(sql`
    SELECT inicio_contabil, conferido_em > NOW() - interval '7 days' AS fresco
      FROM oneflow_empresa WHERE company_id = ${companyId}
  `)) as unknown as { inicio_contabil: string | null; fresco: boolean }[];
  if (g?.fresco) return g.inicio_contabil;
  try {
    const modulos = await cliente.competenciaInicialDosModulos(companyId, appHash);
    const inicio = modulos['Contábil'] ?? modulos['Contabil'] ?? null;
    await db.execute(sql`
      INSERT INTO oneflow_empresa (company_id, inicio_contabil) VALUES (${companyId}, ${inicio})
      ON CONFLICT (company_id) DO UPDATE SET inicio_contabil = EXCLUDED.inicio_contabil, conferido_em = NOW()
    `);
    return inicio;
  } catch (err) {
    if (g) return g.inicio_contabil; // velho, mas melhor que parar
    throw err;
  }
}

/**
 * TURNOS E PRIORIDADE DA COTA — quanto cada rotina pode gastar hoje.
 *
 * Dimensionado para 150 empresas (decisão de 28/09/2026). A cota de 500/dia
 * tem 20% de folga que NENHUMA rotina automática toca — é para imprevisto e
 * para ação manual do escritório. Os 400 restantes seguem a prioridade:
 *
 *   1. retorno   — guias para o cliente pagar: pode usar tudo que houver.
 *   2. nfse      — notas do mês ao fiscal de lá (dias 1 a 5).
 *   3. envio     — lançamentos dos meses liberados.
 *   4. resultado — o balancete oficial, só para exibir.
 *
 * Quem tem prioridade menor deixa guardado o que as de cima ainda vão
 * precisar hoje. Nos dias 1 a 10 — quando as guias saem — a volta tem
 * reserva grande; depois, pequena (sobram folha atrasada e retrasada).
 */
export const FOLGA_DA_COTA = Math.round(COTA_DIARIA * 0.2);
export type RotinaDoOneflow = 'retorno' | 'nfse' | 'envio' | 'resultado';

export function reservaParaAsDeCima(rotina: RotinaDoOneflow, diaDoMes: number): number {
  const diasDeGuia = diaDoMes <= 10;
  const volta = diasDeGuia ? 200 : 60;
  const notas = diaDoMes <= 5 ? 60 : 0;
  switch (rotina) {
    case 'retorno':
      return 0;
    case 'nfse':
      return volta;
    case 'envio':
      return volta + notas;
    case 'resultado':
      return volta + notas + (diasDeGuia ? 80 : 40);
  }
}

/** Chamadas que a rotina pode gastar agora, respeitando folga e prioridade. */
export async function cotaParaRotina(db: DbHandle, rotina: RotinaDoOneflow): Promise<number> {
  const dia = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(8, 10));
  return cotaRestante(db, FOLGA_DA_COTA + reservaParaAsDeCima(rotina, dia));
}

/**
 * Qual plano de contas a empresa usa no OneFlow — 'DINAMICO' ou 'PADRAO' —,
 * pelo `nomeModelo` da primeira página do plano. `null` = sem plano lá (0
 * contas): nada pode ser lançado até alguém configurar o contábil na tela.
 *
 * Guardado por 7 dias em `oneflow_empresa`; `forcar` relê (depois de o
 * escritório trocar o plano lá, por exemplo).
 */
export async function planoDaEmpresa(
  db: DbHandle,
  cliente: { planoDeContas: (c: string, a: string, pagina?: number) => Promise<{ nomeModelo?: string | null }[]> },
  companyId: string,
  appHash: string,
  forcar = false,
): Promise<'DINAMICO' | 'PADRAO' | null> {
  const [g] = (await db.execute(sql`
    SELECT plano_modelo, plano_conferido_em > NOW() - interval '7 days' AS fresco
      FROM oneflow_empresa WHERE company_id = ${companyId}
  `)) as unknown as { plano_modelo: string | null; fresco: boolean | null }[];
  if (g?.fresco && !forcar) return (g.plano_modelo as 'DINAMICO' | 'PADRAO' | null) ?? null;
  const contas = await cliente.planoDeContas(companyId, appHash, 1);
  const nome = contas[0]?.nomeModelo ?? '';
  const plano = /din.mico/i.test(nome) ? 'DINAMICO' : /padr.o/i.test(nome) ? 'PADRAO' : null;
  await db.execute(sql`
    INSERT INTO oneflow_empresa (company_id, plano_modelo, plano_conferido_em) VALUES (${companyId}, ${plano}, NOW())
    ON CONFLICT (company_id) DO UPDATE SET plano_modelo = EXCLUDED.plano_modelo, plano_conferido_em = NOW()
  `);
  return plano;
}

/**
 * O fiscal/folha do OneFlow já lançam sozinhos no contábil de lá nestes
 * meses? Conferido pelo razão: lançamento em Simples a Recolher ou na receita
 * de serviços que NÃO veio do Hub (documento sem "HUB-") = integração ativa lá.
 *
 * Grava `oneflow_competencia.contabil_integrado` por mês — é o que decide se
 * o Hub manda receita (da nota), DAS e folha (ver ORIGEM_ONEFLOW). Uma
 * chamada por conta cobre todos os meses pedidos.
 */
export async function conferirIntegracaoContabil(
  db: DbHandle,
  cliente: { razao: (c: string, a: string, conta: string, ini: string, fim: string) => Promise<{ data?: string; documento?: string }[]> },
  companyId: string,
  appHash: string,
  plano: 'DINAMICO' | 'PADRAO',
  competencias: string[], // AAAAMM
): Promise<Record<string, boolean>> {
  if (!competencias.length) return {};
  const contas = plano === 'PADRAO' ? ['2.1.05.001.002', '3.1.01.007.001.001'] : ['2.1.2.01.00001', '3.1.1.01.00002'];
  const ordenadas = [...competencias].sort();
  const integrado: Record<string, boolean> = Object.fromEntries(competencias.map((c) => [c, false]));
  for (const conta of contas) {
    for (const l of await cliente.razao(companyId, appHash, conta, ordenadas[0]!, ordenadas.at(-1)!)) {
      if (String(l.documento ?? '').startsWith('HUB-')) continue;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(l.data ?? ''));
      if (m) integrado[`${m[3]}${m[2]}`] = true;
    }
  }
  for (const c of competencias) {
    await db.execute(sql`
      INSERT INTO oneflow_competencia (company_id, competencia, contabil_integrado, contabil_conferido_em)
      VALUES (${companyId}, ${c}, ${integrado[c] ?? false}, NOW())
      ON CONFLICT (company_id, competencia) DO UPDATE SET contabil_integrado = EXCLUDED.contabil_integrado, contabil_conferido_em = NOW()
    `);
  }
  return integrado;
}
