import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema/index';

export type DbHandle = PostgresJsDatabase<typeof schema>;

let _db: DbHandle | undefined;
let _tenantDb: DbHandle | undefined;

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
    // prepare:false + max:1 → compatível com o pooler em modo transação (porta 6543)
    // e evita esgotar conexões quando a Vercel escala várias instâncias serverless.
    _db = drizzle(postgres(connectionString, { prepare: false, max: 1 }), { schema });
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
function getTenantDb(): DbHandle {
  const connectionString = process.env.TENANT_DATABASE_URL;
  if (!connectionString) {
    return getDb();
  }
  if (!_tenantDb) {
    _tenantDb = drizzle(postgres(connectionString, { prepare: false, max: 1 }), { schema });
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
  return getTenantDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
    return fn(tx as unknown as DbHandle);
  });
}
