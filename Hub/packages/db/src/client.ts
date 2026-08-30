import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema/index';

export type DbHandle = PostgresJsDatabase<typeof schema>;

let _db: DbHandle | undefined;
let _dbClient: Sql | undefined;
let _tenantDb: DbHandle | undefined;
let _tenantDbClient: Sql | undefined;

/**
 * Corrida contra um timeout do lado do JS: se `promise` não resolver em `ms`,
 * a chamada rejeita e a UI segue (mostra vazio/erro) em vez de pendurar a
 * navegação. NÃO derruba a conexão — com max>1 (pool real), postgres.js e o
 * statement_timeout do lado do Postgres já cuidam de liberar a conexão
 * travada sozinhos; forçar `.end()` aqui já quebrou requisições CONCORRENTES
 * que estavam usando outra conexão do mesmo pool (visto em produção:
 * "CONNECTION_DESTROYED" numa query completamente não relacionada).
 */
export async function withDbTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Consulta ao banco não respondeu em ${ms}ms.`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Conexão preguiçosa: só exige DATABASE_URL quando o banco é realmente usado
 * (não no import). Assim a UI renderiza mesmo sem o banco configurado.
 *
 * Usa o role padrão (hoje com BYPASSRLS) — só deve ser chamado direto em
 * contextos que legitimamente precisam ver todas as empresas (admin, com seu
 * próprio gate de autorização). Qualquer leitura/escrita de dados de UMA
 * empresa deve passar por withTenant().
 */
export function getDb(): DbHandle {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL ausente. Configure o .env.local (banco PRÓPRIO do Hub).');
    }
    // max:5 (não 1): a Vercel roda requisições concorrentes na mesma
    // instância (Fluid Compute) — com max:1 elas disputavam a MESMA conexão
    // física, e destruir/recriar essa conexão numa request derrubava outra
    // request em andamento no meio da query (visto em produção).
    // idle_timeout/max_lifetime: sem isso, uma function serverless que morre
    // sem fechar a conexão deixa ela presa no pool do Supabase até o TCP
    // expirar sozinho — o que já travou o login pra usuários reais.
    _dbClient = postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
      // statement_timeout aqui (não só via ALTER DATABASE): o pooler do
      // Supabase reaproveita conexões físicas antigas que não pegam um
      // default novo definido no banco — isso aqui vale por conexão, sempre.
      connection: { statement_timeout: 8000 },
    });
    _db = drizzle(_dbClient, { schema });
  }
  return _db;
}

/**
 * Conexão usada por withTenant(): usa TENANT_DATABASE_URL (role restrito,
 * sem BYPASSRLS) quando configurado. Enquanto essa variável não existir,
 * cai para DATABASE_URL (mesmo comportamento de hoje) — assim o app continua
 * funcionando até o role `hexxa_app` ser criado no banco
 * (ver packages/db/migrations/manual_create_tenant_role.sql).
 */
let warnedMissingTenantDb = false;

function getTenantDb(): DbHandle {
  const connectionString = process.env.TENANT_DATABASE_URL;
  if (!connectionString) {
    // Sem essa var, withTenant() roda na conexão admin (BYPASSRLS) — a
    // única barreira de isolamento entre empresas vira o WHERE company_id
    // manual de cada query, sem a defesa em profundidade do RLS. Isso não
    // pode passar batido em silêncio se acontecer em produção.
    if (!warnedMissingTenantDb) {
      warnedMissingTenantDb = true;
      const msg = 'TENANT_DATABASE_URL não configurada — withTenant() está caindo pra conexão admin (BYPASSRLS). Isolamento entre empresas depende só do WHERE manual de cada query.';
      if (process.env.NODE_ENV === 'production') console.error(`[db] CRÍTICO: ${msg}`);
      else console.warn(`[db] ${msg}`);
    }
    return getDb();
  }
  if (!_tenantDb) {
    _tenantDbClient = postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
      // statement_timeout aqui (não só via ALTER DATABASE): o pooler do
      // Supabase reaproveita conexões físicas antigas que não pegam um
      // default novo definido no banco — isso aqui vale por conexão, sempre.
      connection: { statement_timeout: 8000 },
    });
    _tenantDb = drizzle(_tenantDbClient, { schema });
  }
  return _tenantDb;
}

/**
 * Executa uma transação amarrada a um tenant: seta app.company_id para que as
 * policies de RLS isolem os dados. Toda leitura/escrita de dados de UMA
 * empresa (rotas do portal do cliente) deve passar por aqui.
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: DbHandle) => Promise<T>,
): Promise<T> {
  return withDbTimeout(
    getTenantDb().transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
      return fn(tx as unknown as DbHandle);
    }),
    12000,
  );
}
