import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    await sql.unsafe(`
      ALTER TABLE "company" 
      ADD COLUMN IF NOT EXISTS "municipal_registration" text,
      ADD COLUMN IF NOT EXISTS "address_line1" text,
      ADD COLUMN IF NOT EXISTS "address_number" text,
      ADD COLUMN IF NOT EXISTS "neighborhood" text,
      ADD COLUMN IF NOT EXISTS "city" text,
      ADD COLUMN IF NOT EXISTS "state" text,
      ADD COLUMN IF NOT EXISTS "zipcode" text;
      
      CREATE TABLE IF NOT EXISTS "nfse_config" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE UNIQUE,
        "certificate_type" text,
        "certificate_owner" text,
        "certificate_expiry" date,
        "default_cnae" text,
        "default_municipal_code" text,
        "focus_nfe_env" text DEFAULT 'homologacao',
        "focus_nfe_token" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
      
      CREATE TABLE IF NOT EXISTS "nfse_service_profile" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "cnae" text,
        "municipal_service_code" text,
        "default_iss_rate" numeric(5, 2),
        "is_default" text DEFAULT 'false',
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
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
