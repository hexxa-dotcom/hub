import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { company } from './tenancy';
import { customer } from './service-ops';

export const emailAccount = pgTable('email_account', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' })
    .unique(),
  provider: text('provider').notNull().default('IMAP'), // 'IMAP' | 'GOOGLE' | 'OUTLOOK'
  emailAddress: text('email_address').notNull(),
  imapHost: text('imap_host'),
  imapPort: text('imap_port'),
  smtpHost: text('smtp_host'),
  smtpPort: text('smtp_port'),
  username: text('username'),
  password: text('password'), // Will store encrypted password or token
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailMessage = pgTable('email_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => company.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => emailAccount.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  remoteId: text('remote_id').notNull(), // UID of the IMAP message
  subject: text('subject'),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  bodyText: text('body_text'),
  isRead: boolean('is_read').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
