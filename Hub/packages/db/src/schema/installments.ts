import {pgTable,uuid,text,jsonb,numeric,integer,timestamp,uniqueIndex} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import {company} from './tenancy';
export const taxInstallmentImport=pgTable('tax_installment_import',{
 id:uuid('id').primaryKey().defaultRandom(),companyId:uuid('company_id').notNull().references(()=>company.id),
 sourceHash:text('source_hash').notNull(),sourceName:text('source_name').notNull(),sourcePdf:text('source_pdf').notNull(),extractedData:jsonb('extracted_data').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('tax_installment_import_company_hash').on(t.companyId,t.sourceHash)]);
export const taxInstallmentPlan=pgTable('tax_installment_plan',{
 id:uuid('id').primaryKey().defaultRandom(),companyId:uuid('company_id').notNull().references(()=>company.id),
 description:text('description').notNull(),tax:text('tax').notNull(),authority:text('authority').notNull(),agreement:text('agreement').notNull(),
 totalAmount:numeric('total_amount',{precision:14,scale:2}).notNull(),installmentCount:integer('installment_count').notNull(),
 sourceHash:text('source_hash').notNull(),sourceName:text('source_name'),sourcePdf:text('source_pdf'),details:jsonb('details').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('tax_installment_plan_company_hash').on(t.companyId,t.sourceHash),uniqueIndex('tax_installment_plan_agreement').on(t.companyId,sql`lower(${t.authority})`,sql`lower(${t.agreement})`).where(sql`${t.agreement}<>''`)]);
