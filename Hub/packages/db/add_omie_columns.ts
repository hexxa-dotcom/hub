import postgres from 'postgres';

async function run() {
  console.log('Connecting to', process.env.DATABASE_URL);
  const sql = postgres(process.env.DATABASE_URL as string);
  
  try {
    await sql`ALTER TABLE category ADD COLUMN accounting_code text;`;
    console.log('Added accounting_code');
  } catch(e: any) {
    console.log('accounting_code already exists or error:', e.message);
  }
  
  try {
    await sql`ALTER TABLE category ADD COLUMN accounting_group text;`;
    console.log('Added accounting_group');
  } catch(e: any) {
    console.log('accounting_group already exists or error:', e.message);
  }

  process.exit(0);
}
run();
