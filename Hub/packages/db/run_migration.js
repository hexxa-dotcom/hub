import fs from 'fs';
import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  const query = fs.readFileSync('migrations/0003_nfse_service_profile.sql', 'utf8');
  await sql.unsafe(query);
  await sql.unsafe("NOTIFY pgrst, 'reload schema'");
  console.log('Migration and schema reload complete.');
  process.exit(0);
}
run();
