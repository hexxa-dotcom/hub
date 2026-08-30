import * as fs from 'fs';
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
import { getDb } from './index';
import { taxAnnexBracket, taxRegimeSetting } from './schema/tax_rules';
import { sql } from 'drizzle-orm';

// Executar: npx tsx packages/db/src/seed-tax-rules.ts
async function seedTaxRules() {
  const db = getDb();
  console.log('🤖 Iniciando Robô Semeador Tributário Hexx (Foco: SERVIÇOS)...');

  const validFrom = '2018-01-01';

  // === ANEXO III ===
  // Fonte: Receita Federal, "ANEXO III Alíquotas e Partilha do Simples
  // Nacional" (normas.receita.fazenda.gov.br, idArquivoBinario=48432).
  // A repartição VARIA por faixa — não é a mesma nas faixas 1 a 5 (bug
  // anterior: as 5 primeiras linhas usavam a repartição da faixa 1 copiada,
  // e a faixa 6 não somava 100%).
  console.log('Populando Anexo III (Regra de 2018+)...');
  const anexoIII = [
    { bracket: 1, minRevenue: '0', maxRevenue: '180000', nominalRate: '6.00', deductionAmount: '0', partitionDistribution: { irpj: 4.0, csll: 3.5, cofins: 12.82, pis: 2.78, cpp: 43.4, iss: 33.5 } },
    { bracket: 2, minRevenue: '180000.01', maxRevenue: '360000', nominalRate: '11.20', deductionAmount: '9360.00', partitionDistribution: { irpj: 4.0, csll: 3.5, cofins: 14.05, pis: 3.05, cpp: 43.4, iss: 32.0 } },
    { bracket: 3, minRevenue: '360000.01', maxRevenue: '720000', nominalRate: '13.50', deductionAmount: '17640.00', partitionDistribution: { irpj: 4.0, csll: 3.5, cofins: 13.64, pis: 2.96, cpp: 43.4, iss: 32.5 } },
    { bracket: 4, minRevenue: '720000.01', maxRevenue: '1800000', nominalRate: '16.00', deductionAmount: '35640.00', partitionDistribution: { irpj: 4.0, csll: 3.5, cofins: 13.64, pis: 2.96, cpp: 43.4, iss: 32.5 } },
    { bracket: 5, minRevenue: '1800000.01', maxRevenue: '3600000', nominalRate: '21.00', deductionAmount: '125640.00', partitionDistribution: { irpj: 4.0, csll: 3.5, cofins: 12.82, pis: 2.78, cpp: 43.4, iss: 33.5 } },
    { bracket: 6, minRevenue: '3600000.01', maxRevenue: '4800000', nominalRate: '33.00', deductionAmount: '648000.00', partitionDistribution: { irpj: 35.0, csll: 15.0, cofins: 16.03, pis: 3.47, cpp: 30.5, iss: 0.0 } }, // ISS e ICMS são recolhidos por fora no sublimite
  ];

  // === ANEXO IV ===
  // Fonte: Receita Federal, "ANEXO IV Alíquotas e Partilha do Simples
  // Nacional" (idArquivoBinario=48433). Anexo IV não tem CPP embutido (o
  // prestador recolhe INSS patronal por fora). Mesmo bug do Anexo III: as
  // faixas 1-5 estavam todas com a mesma repartição copiada, e a faixa 6
  // somava 144,79% em vez de 100%.
  console.log('Populando Anexo IV (Regra de 2018+)...');
  const anexoIV = [
    { bracket: 1, minRevenue: '0', maxRevenue: '180000', nominalRate: '4.50', deductionAmount: '0', partitionDistribution: { irpj: 18.8, csll: 15.2, cofins: 17.67, pis: 3.83, cpp: 0, iss: 44.5 } },
    { bracket: 2, minRevenue: '180000.01', maxRevenue: '360000', nominalRate: '9.00', deductionAmount: '8100.00', partitionDistribution: { irpj: 19.8, csll: 15.2, cofins: 20.55, pis: 4.45, cpp: 0, iss: 40.0 } },
    { bracket: 3, minRevenue: '360000.01', maxRevenue: '720000', nominalRate: '10.20', deductionAmount: '12420.00', partitionDistribution: { irpj: 20.8, csll: 15.2, cofins: 19.73, pis: 4.27, cpp: 0, iss: 40.0 } },
    { bracket: 4, minRevenue: '720000.01', maxRevenue: '1800000', nominalRate: '14.00', deductionAmount: '39780.00', partitionDistribution: { irpj: 17.8, csll: 19.2, cofins: 18.9, pis: 4.1, cpp: 0, iss: 40.0 } },
    { bracket: 5, minRevenue: '1800000.01', maxRevenue: '3600000', nominalRate: '22.00', deductionAmount: '183780.00', partitionDistribution: { irpj: 18.8, csll: 19.2, cofins: 18.08, pis: 3.92, cpp: 0, iss: 40.0 } },
    { bracket: 6, minRevenue: '3600000.01', maxRevenue: '4800000', nominalRate: '33.00', deductionAmount: '828000.00', partitionDistribution: { irpj: 53.5, csll: 21.5, cofins: 20.55, pis: 4.45, cpp: 0, iss: 0.0 } },
  ];

  // === ANEXO V ===
  // Fonte: Receita Federal, "ANEXO V Alíquotas e Partilha do Simples
  // Nacional" (idArquivoBinario=48446) — já conferido linha a linha, batia
  // com o oficial; só a faixa 6 tinha pis=3.57 em vez de 3.56 (a soma
  // fechava em 100,01% em vez de 100,00% por causa desse arredondamento).
  console.log('Populando Anexo V (Regra de 2018+)...');
  const anexoV = [
    { bracket: 1, minRevenue: '0', maxRevenue: '180000', nominalRate: '15.50', deductionAmount: '0', partitionDistribution: { irpj: 25.0, csll: 15.0, cofins: 14.1, pis: 3.05, cpp: 28.85, iss: 14.0 } },
    { bracket: 2, minRevenue: '180000.01', maxRevenue: '360000', nominalRate: '18.00', deductionAmount: '4500.00', partitionDistribution: { irpj: 23.0, csll: 15.0, cofins: 14.1, pis: 3.05, cpp: 27.85, iss: 17.0 } },
    { bracket: 3, minRevenue: '360000.01', maxRevenue: '720000', nominalRate: '19.50', deductionAmount: '9900.00', partitionDistribution: { irpj: 24.0, csll: 15.0, cofins: 14.92, pis: 3.23, cpp: 23.85, iss: 19.0 } },
    { bracket: 4, minRevenue: '720000.01', maxRevenue: '1800000', nominalRate: '20.50', deductionAmount: '17100.00', partitionDistribution: { irpj: 21.0, csll: 15.0, cofins: 15.74, pis: 3.41, cpp: 23.85, iss: 21.0 } },
    { bracket: 5, minRevenue: '1800000.01', maxRevenue: '3600000', nominalRate: '23.00', deductionAmount: '62100.00', partitionDistribution: { irpj: 23.0, csll: 12.5, cofins: 14.1, pis: 3.05, cpp: 23.85, iss: 23.5 } },
    { bracket: 6, minRevenue: '3600000.01', maxRevenue: '4800000', nominalRate: '30.50', deductionAmount: '540000.00', partitionDistribution: { irpj: 35.0, csll: 15.5, cofins: 16.44, pis: 3.56, cpp: 29.5, iss: 0.0 } },
  ];

  await db.transaction(async (tx) => {
    console.log('Verificando e criando tabelas caso não existam...');
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "tax_annex_bracket" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "annex" text NOT NULL,
        "bracket" integer NOT NULL,
        "min_revenue" numeric(14, 2) NOT NULL DEFAULT '0',
        "max_revenue" numeric(14, 2),
        "nominal_rate" numeric(6, 4) NOT NULL,
        "deduction_amount" numeric(14, 2) NOT NULL DEFAULT '0',
        "partition_distribution" jsonb NOT NULL DEFAULT '{}',
        "valid_from" date NOT NULL,
        "valid_until" date,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "tax_regime_setting" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "setting_code" text NOT NULL,
        "name" text NOT NULL,
        "parameters" jsonb NOT NULL DEFAULT '{}',
        "valid_from" date NOT NULL,
        "valid_until" date,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    
    // Colunas precisam bater EXATAMENTE com packages/db/src/schema/tax_rules.ts
    // (companyTaxProfile) — esse CREATE é a única fonte que cria essa tabela
    // hoje (não existe migration própria pra ela ainda). Estava divergente:
    // "default_annex"/"is_sup" em vez de "primary_annex"/"subject_to_fator_r",
    // faltava "custom_settings" inteira, e a precisão de "municipal_iss_rate"
    // era numeric(5,4) em vez de numeric(5,2) — qualquer código usando o
    // objeto Drizzle real ia falhar com "coluna não existe".
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "company_tax_profile" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL UNIQUE REFERENCES "company"("id") ON DELETE CASCADE,
        "regime" "tax_regime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
        "primary_annex" text,
        "subject_to_fator_r" boolean NOT NULL DEFAULT false,
        "municipal_iss_rate" numeric(5, 2),
        "custom_settings" jsonb NOT NULL DEFAULT '{}',
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);

    // Limpa tabelas antes de popular (Apenas p/ o seed de desenvolvimento)
    await tx.delete(taxAnnexBracket).execute();
    await tx.delete(taxRegimeSetting).execute();

    const insertAnnex = async (annexName: string, data: any[]) => {
      for (const row of data) {
        await tx.insert(taxAnnexBracket).values({
          annex: annexName,
          bracket: row.bracket,
          minRevenue: row.minRevenue,
          maxRevenue: row.maxRevenue,
          nominalRate: row.nominalRate,
          deductionAmount: row.deductionAmount,
          partitionDistribution: row.partitionDistribution,
          validFrom,
        });
      }
    };

    await insertAnnex('III', anexoIII);
    await insertAnnex('IV', anexoIV);
    await insertAnnex('V', anexoV);

    console.log('✅ Anexos inseridos com sucesso!');

    // Inserindo Parâmetros Gerais e MEI
    console.log('Populando Parâmetros Gerais e MEI...');
    await tx.insert(taxRegimeSetting).values([
      {
        settingCode: 'SIMPLES_NACIONAL_LIMITS',
        name: 'Limites do Simples Nacional',
        validFrom,
        parameters: {
          revenueCeiling: 4800000,
          stateSublimit: 3600000,
          fatorRTrigger: 0.28,
        }
      },
      {
        settingCode: 'MEI_LIMITS',
        name: 'Limites do MEI',
        validFrom,
        parameters: {
          revenueCeiling: 81000,
          fixedIss: 5.0,
          fixedIcms: 1.0,
          inssPercentage: 0.05, // 5% do Salário Mínimo
        }
      },
      {
        // Salário mínimo nacional — Decreto nº 12.797/2025, vigente desde
        // 01/01/2026 (R$ 1.621,00; era R$ 1.518,00 em 2025, R$ 1.412,00 em
        // 2024). Sem isso configurável, o Piloto Automático de Pró-labore
        // usava uma constante de 2024 hardcoded no código, arriscando
        // recomendar retirada abaixo do piso legal vigente.
        settingCode: 'MINIMUM_WAGE',
        name: 'Salário Mínimo Nacional',
        validFrom: '2026-01-01',
        parameters: {
          value: 1621.00,
        }
      }
    ]);

    console.log('✅ Parâmetros globais inseridos com sucesso!');
  });

  console.log('🚀 Robô Semeador concluído! Banco de dados atualizado com inteligência para prestadores de serviços.');
  process.exit(0);
}

seedTaxRules().catch(err => {
  console.error('Erro no Robô:', err);
  process.exit(1);
});
