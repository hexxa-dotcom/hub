import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
import { getDb } from './index';
import { company } from './schema/tenancy';
import { financialEntry } from './schema/finance';
import { sql } from 'drizzle-orm';

async function check() {
  const db = getDb();
  const companies = await db.select().from(company).orderBy(company.createdAt).limit(5);
  console.log('Companies:', JSON.stringify(companies, null, 2));

  if (companies.length > 0) {
    const activeCompany = companies[0]!;
    const entriesCount = await db.execute(sql`SELECT count(*)::int as count FROM financial_entry WHERE company_id = ${activeCompany.id}`);
    console.log(`Active Company ID: ${activeCompany.id} (${activeCompany.legalName})`);
    console.log('Entries count:', entriesCount);
  }
  process.exit(0);
}

check().catch(console.error);
