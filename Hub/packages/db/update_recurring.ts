import { sql } from 'drizzle-orm';
import { getDb } from './src';
import * as fs from 'fs';

async function main() {
  const envFile = fs.readFileSync('../../apps/web/.env.local', 'utf-8');
  for (const line of envFile.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      process.env.DATABASE_URL = line.substring('DATABASE_URL='.length).replace(/"/g, '').replace(/'/g, '');
    }
  }
  
  if (!process.env.DATABASE_URL) throw new Error('Could not find DATABASE_URL in .env.local');

  const db = getDb();
  await db.execute(sql`ALTER TABLE recurring_expense ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'PAYABLE';`);
  console.log('Migration done: added type to recurring_expense');
  process.exit(0);
}

main().catch(console.error);
