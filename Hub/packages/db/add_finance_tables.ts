import postgres from 'postgres';

async function run() {
  console.log('Connecting to', process.env.DATABASE_URL);
  const sql = postgres(process.env.DATABASE_URL as string);
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS business_partner (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        name text NOT NULL,
        document text,
        type text NOT NULL DEFAULT 'CLIENT',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    console.log('Created business_partner');
  } catch(e: any) {
    console.log('business_partner error:', e.message);
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cost_center (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    console.log('Created cost_center');
  } catch(e: any) {
    console.log('cost_center error:', e.message);
  }

  const columns = [
    { name: 'original_amount', type: 'numeric(14,2)' },
    { name: 'interest', type: 'numeric(14,2)' },
    { name: 'discount', type: 'numeric(14,2)' },
    { name: 'partner_id', type: 'uuid REFERENCES business_partner(id)' },
    { name: 'cost_center_id', type: 'uuid REFERENCES cost_center(id)' },
  ];

  for (const col of columns) {
    try {
      await sql.unsafe(`ALTER TABLE financial_entry ADD COLUMN ${col.name} ${col.type};`);
      console.log(`Added ${col.name}`);
    } catch(e: any) {
      console.log(`${col.name} already exists or error:`, e.message);
    }
  }

  process.exit(0);
}
run();
