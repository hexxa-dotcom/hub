import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    await sql`ALTER TABLE property ADD COLUMN acquisition_date date;`;
  } catch (e) { console.log('acquisition_date exist', e.message); }
  
  try {
    await sql`ALTER TABLE property ADD COLUMN depreciation_rate numeric(5,2);`;
  } catch (e) { console.log('depreciation_rate exist', e.message); }
  
  try {
    await sql`ALTER TABLE property ADD COLUMN residual_value numeric(14,2);`;
  } catch (e) { console.log('residual_value exist', e.message); }
  
  console.log('Migration complete');
  process.exit(0);
}

run();
