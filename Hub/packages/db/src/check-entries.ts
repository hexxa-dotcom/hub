import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
import { getDb } from './index';
import { sql } from 'drizzle-orm';

async function checkEntries() {
  const db = getDb();
  const companyId = 'ad35fdf7-3e07-4ad1-9d5d-ffe1c0356109';
  const entries = await db.execute(sql`
    SELECT id, type, status, description, amount, due_date, reference_month
    FROM financial_entry
    WHERE company_id = ${companyId}
    ORDER BY due_date DESC
    LIMIT 25
  `);
  console.log('Entries:', JSON.stringify(entries, null, 2));
  process.exit(0);
}

checkEntries().catch(console.error);
