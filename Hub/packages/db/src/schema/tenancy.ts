import { pgTable, uuid, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';
import { companyType, taxRegime, userRole } from './_enums';

/** Tenant raiz. CompanyType separa o fluxo SERVICE do HOLDING. */
export const company = pgTable('company', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  useTradeName: boolean('use_trade_name').notNull().default(false),
  cnpj: text('cnpj').notNull().unique(),
  type: companyType('type').notNull(),
  taxRegime: taxRegime('tax_regime').notNull().default('SIMPLES_NACIONAL'),
  /** Teto de faturamento p/ a Bússola Tributária. */
  revenueCeiling: numeric('revenue_ceiling', { precision: 14, scale: 2 }),
  /** MENSAL | TRIMESTRAL | SEMESTRAL | ANUAL — periodicidade de distribuição de lucro escolhida. */
  profitDistributionFrequency: text('profit_distribution_frequency').notNull().default('MENSAL'),
  municipalRegistration: text('municipal_registration'),
  addressLine1: text('address_line1'),
  addressNumber: text('address_number'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  zipcode: text('zipcode'),
  /** Organização do Clerk vinculada (auth multi-empresa). */
  clerkOrgId: text('clerk_org_id').unique(),
  /** Token BYOK do Autentique para gestão de assinaturas do cliente. */
  autentiqueToken: text('autentique_token'),
  /** Capital social ainda não integralizado (Código Civil Art. 1.059 veda distribuição de lucro enquanto > 0) — alimenta o ProfitDistributionService. */
  unpaidShareCapital: numeric('unpaid_share_capital', { precision: 14, scale: 2 }).notNull().default('0'),
  /** Contrato Social prevê distribuição desproporcional à participação societária — checado pelo ProfitDistributionService. */
  allowsDisproportionateDistribution: boolean('allows_disproportionate_distribution').notNull().default(false),
  /**
   * Cliente encerrado: nenhum cron opera sobre a empresa. Os dados ficam —
   * o histórico contábil é guardado por lei. Nulo = cliente ativo.
   */
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedReason: text('closed_reason'),
  /** Quando o Hub criou ou vinculou a empresa no OneFlow, na aprovação. Ver 0066. */
  oneflowCreatedAt: timestamp('oneflow_created_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Usuário da plataforma (espelha o auth do Supabase via auth_uid). */
export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUid: text('auth_uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  /** CPF e celular do responsável — o OneFlow exige para criar a empresa. Ver 0066. */
  cpf: text('cpf'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Vínculo N:N — um contador (ACCOUNTANT) acessa várias empresas. */
export const membership = pgTable('membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  role: userRole('role').notNull().default('VIEWER'),
  /**
   * Cadastro aprovado pelo contador. Enquanto falso, o portal mostra só
   * "cadastro em validação" — ver (portal)/layout.tsx.
   */
  authorized: boolean('authorized').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
