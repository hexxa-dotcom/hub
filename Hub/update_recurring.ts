import { sql } from 'drizzle-orm';
import { getDb } from './packages/db/src';

// Requer DATABASE_URL no ambiente — ex.: node --env-file=apps/web/.env.local update_recurring.ts
async function main() {
  const db = getDb();
  await db.execute(sql`ALTER TABLE recurring_expense ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'PAYABLE';`);
  console.log('Migration done: added type to recurring_expense');
  process.exit(0);
}

main().catch(console.error);
