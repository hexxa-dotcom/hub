import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql.unsafe(`ALTER TABLE nfse_service_profile ADD COLUMN IF NOT EXISTS default_description TEXT;`);
    await sql.unsafe("NOTIFY pgrst, 'reload schema'");
    console.log('Column added and schema reloaded.');
  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    process.exit(0);
  }
}
run();
