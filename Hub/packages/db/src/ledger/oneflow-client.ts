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

/** Cliente autenticado. A cadeia de tokens se renova sozinha a partir daqui. */
export function clienteOneflow(db: DbHandle): OneflowAdapter {
  return new OneflowAdapter(new PgOneflowTokenStore(db));
}

/**
 * `app_hash` da empresa no OneFlow, casado pelo CNPJ.
 *
 * O Hub identifica a empresa pelo seu próprio uuid; o OneFlow, por um hash
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
    if (achou) return achou.appHash ?? (achou.app_hash as string) ?? null;
  }
  return null;
}
