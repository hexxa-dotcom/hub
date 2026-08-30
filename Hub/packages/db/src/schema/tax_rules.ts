import { pgTable, uuid, text, numeric, timestamp, boolean, jsonb, date, integer } from 'drizzle-orm/pg-core';
import { taxRegime } from './_enums';
import { company } from './tenancy';

/**
 * 1. Tabelas de Alíquotas do Simples Nacional (Anexos I a V)
 * Versionadas temporalmente (validFrom, validUntil).
 */
export const taxAnnexBracket = pgTable('tax_annex_bracket', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Qual anexo: 'I', 'II', 'III', 'IV', 'V' */
  annex: text('annex').notNull(),
  /** Faixa de 1 a 6 */
  bracket: integer('bracket').notNull(),
  /** Limite inferior da faixa de faturamento (RBT12) */
  minRevenue: numeric('min_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
  /** Limite superior da faixa de faturamento (RBT12). Null se for a última. */
  maxRevenue: numeric('max_revenue', { precision: 14, scale: 2 }),
  /** Alíquota nominal da faixa em % (ex: 6.00 para 6%) */
  nominalRate: numeric('nominal_rate', { precision: 6, scale: 4 }).notNull(),
  /** Parcela a deduzir em R$ */
  deductionAmount: numeric('deduction_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  /** Repartição dos tributos (% da alíquota efetiva que vai para cada ente) - ex: IRPJ, CSLL, COFINS, PIS, CPP, ICMS, ISS */
  partitionDistribution: jsonb('partition_distribution').notNull().default('{}'),
  /** Temporal Data: Data inicial de vigência desta regra (ex: 2018-01-01) */
  validFrom: date('valid_from').notNull(),
  /** Temporal Data: Data final de vigência desta regra. Null = Vigente atual. */
  validUntil: date('valid_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 2. Parâmetros Gerais e Retenções (Limites, Fator R, Lucro Presumido)
 * Versionada temporalmente.
 */
export const taxRegimeSetting = pgTable('tax_regime_setting', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Identificador da regra (ex: 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO_SERVICOS', 'RETENCAO_FEDERAL') */
  settingCode: text('setting_code').notNull(),
  /** Nome legível (ex: Parâmetros Gerais Simples Nacional) */
  name: text('name').notNull(),
  /** JSON contendo os parâmetros matemáticos daquela regra.
   * Ex: { "fatorRLimit": 0.28, "revenueCeiling": 4800000, "stateSublimit": 3600000 }
   * Ex LP: { "presumidoBaseIrf": 0.32, "irpjRate": 0.15, "csllRate": 0.09, "pisRate": 0.0065, "cofinsRate": 0.03 }
   */
  parameters: jsonb('parameters').notNull(),
  validFrom: date('valid_from').notNull(),
  validUntil: date('valid_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 3. Perfil Tributário Customizado por Empresa
 * Define em qual caixa a empresa se encaixa e suas exceções.
 */
export const companyTaxProfile = pgTable('company_tax_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .unique()
    .references(() => company.id, { onDelete: 'cascade' }),
  /** Regime Tributário predominante */
  regime: taxRegime('regime').notNull().default('SIMPLES_NACIONAL'),
  /** Anexo Padrão (ex: 'III', 'V') */
  primaryAnnex: text('primary_annex'),
  /** Se a empresa tem atividades sujeitas ao Fator R */
  subjectToFatorR: boolean('subject_to_fator_r').notNull().default(false),
  /** Alíquota de ISS Municipal padrão do Município da Empresa (ex: 2.00, 5.00) */
  municipalIssRate: numeric('municipal_iss_rate', { precision: 5, scale: 2 }),
  /** Configurações extra/avançadas em JSON */
  customSettings: jsonb('custom_settings').notNull().default('{}'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
