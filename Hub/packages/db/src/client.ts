import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema/index';

export type DbHandle = PostgresJsDatabase<typeof schema>;

let _db: DbHandle | undefined;

/**
 * Conexão preguiçosa: só exige DATABASE_URL quando o banco é realmente usado
 * (não no import). Assim a UI renderiza mesmo sem o banco configurado.
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
 * Executa uma transação amarrada a um tenant: seta app.company_id para que as
 * policies de RLS isolem os dados. Toda leitura/escrita do app passa por aqui.
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: DbHandle) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
    return fn(tx as unknown as DbHandle);
  });
}
