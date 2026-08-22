import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    await sql.unsafe(`
      ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "autentique_token" text;
    `);
    // Criando a tabela tax_history
    await sql`
      CREATE TABLE IF NOT EXISTS tax_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        reference_month varchar(7) NOT NULL,
        rba12 numeric(15,2) NOT NULL,
        effective_rate numeric(5,2) NOT NULL,
        tax_bracket varchar(50) NOT NULL,
        pdf_url varchar(255),
        created_at timestamp NOT NULL DEFAULT NOW()
      );
    `;
    console.log('Tabela tax_history verificada/criada.');
    
    // Add unique constraint on company_id + reference_month
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'tax_history_month_idx'
        ) THEN
            ALTER TABLE tax_history ADD CONSTRAINT tax_history_month_idx UNIQUE (company_id, reference_month);
        END IF;
      END $$;
    `;
    console.log('Migration tax_history ensured!');

    await sql`
      ALTER TABLE company 
      ADD COLUMN IF NOT EXISTS use_trade_name BOOLEAN NOT NULL DEFAULT false;
    `;
    console.log('Migration company use_trade_name ensured!');

    console.log('Todas as migrações (incluindo as customizadas) aplicadas com sucesso!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

main();
