import 'server-only';
import { getDb, withDbTimeout, eq, and, sql } from '@hexxa/db';
import { financialEntry, businessPartner, integrationCredential, customer } from '@hexxa/db/schema';
import { NiboAdapter, type NiboSchedule, type NiboCustomer } from '@hexxa/integrations';
import { decryptSecret } from './secret-crypto';

/**
 * Importa (read-only) contas a pagar/receber e cadastro de clientes do Nibo
 * pra dentro do Hub — ponte temporária enquanto a empresa migra do Nibo pro
 * Hub de vez. Nunca escreve nada no Nibo. Idempotente: lançamentos via
 * `financial_entry.external_id` (`nibo:<scheduleId>`), clientes via
 * `customer.document` — rodar de novo atualiza, nunca duplica.
 */

export interface NiboSyncResult {
  companyId: string;
  imported: number;
  updated: number;
  customersImported: number;
  customersUpdated: number;
  errors: string[];
}

async function upsertPartner(companyId: string, stakeholder: NiboSchedule['stakeholder']): Promise<string | null> {
  if (!stakeholder?.cpfCnpj) return null;
  const db = getDb();
  const [existing] = await withDbTimeout(
    db
      .select({ id: businessPartner.id })
      .from(businessPartner)
      .where(and(eq(businessPartner.companyId, companyId), eq(businessPartner.document, stakeholder.cpfCnpj))),
    8000,
  );
  if (existing) return existing.id;
  const [created] = await withDbTimeout(
    db
      .insert(businessPartner)
      .values({ companyId, name: stakeholder.name, document: stakeholder.cpfCnpj, type: 'BOTH' })
      .returning({ id: businessPartner.id }),
    8000,
  );
  return created!.id;
}

async function upsertScheduleEntry(companyId: string, schedule: NiboSchedule): Promise<'imported' | 'updated'> {
  const db = getDb();
  const partnerId = await upsertPartner(companyId, schedule.stakeholder);
  const externalId = `nibo:${schedule.scheduleId}`;
  const dueDate = schedule.dueDate.slice(0, 10);
  const referenceMonth = `${dueDate.slice(0, 7)}-01`;

  const [existing] = await withDbTimeout(
    db.select({ id: financialEntry.id }).from(financialEntry).where(eq(financialEntry.externalId, externalId)),
    8000,
  );

  const values = {
    companyId,
    partnerId,
    type: (schedule.type === 'Credit' ? 'RECEIVABLE' : 'PAYABLE') as 'RECEIVABLE' | 'PAYABLE',
    status: (schedule.isPaid ? 'PAID' : 'PENDING') as 'PAID' | 'PENDING',
    description: schedule.description || 'Importado do Nibo',
    amount: String(schedule.value),
    dueDate,
    referenceMonth,
    source: 'IMPORT',
    externalId,
  };

  if (existing) {
    await withDbTimeout(db.update(financialEntry).set(values).where(eq(financialEntry.id, existing.id)), 8000);
    return 'updated';
  }
  await withDbTimeout(db.insert(financialEntry).values(values), 8000);
  return 'imported';
}

async function upsertCustomer(companyId: string, niboCustomer: NiboCustomer): Promise<'imported' | 'updated' | 'skipped'> {
  if (!niboCustomer.document) return 'skipped'; // sem CPF/CNPJ não dá pra casar/deduplicar com segurança
  const db = getDb();

  const values = {
    companyId,
    name: niboCustomer.name,
    document: niboCustomer.document,
    email: niboCustomer.email,
    phone: niboCustomer.phone,
    address: niboCustomer.address,
    type: (niboCustomer.documentType === 'Cnpj' ? 'PJ' : 'PF') as 'PF' | 'PJ',
  };

  const [existing] = await withDbTimeout(
    db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.companyId, companyId), eq(customer.document, niboCustomer.document))),
    8000,
  );

  if (existing) {
    await withDbTimeout(db.update(customer).set(values).where(eq(customer.id, existing.id)), 8000);
    return 'updated';
  }
  await withDbTimeout(db.insert(customer).values(values), 8000);
  return 'imported';
}

/** Roda a sincronização pra uma empresa específica, usando a credencial ativa dela. */
export async function syncNiboForCompany(companyId: string, apiToken: string): Promise<NiboSyncResult> {
  const adapter = new NiboAdapter(apiToken);
  const result: NiboSyncResult = { companyId, imported: 0, updated: 0, customersImported: 0, customersUpdated: 0, errors: [] };

  const [credits, debits, customers] = await Promise.all([
    adapter.listCreditSchedules(),
    adapter.listDebitSchedules(),
    adapter.listCustomers(),
  ]);

  // Cadastro de clientes primeiro — lançamentos financeiros referenciam parceiros, faz sentido a base existir antes.
  for (const niboCustomer of customers) {
    try {
      const outcome = await upsertCustomer(companyId, niboCustomer);
      if (outcome === 'imported') result.customersImported++;
      else if (outcome === 'updated') result.customersUpdated++;
    } catch (err: any) {
      result.errors.push(`Cliente ${niboCustomer.id}: ${err.message}`);
    }
  }

  for (const schedule of [...credits, ...debits]) {
    try {
      const outcome = await upsertScheduleEntry(companyId, schedule);
      if (outcome === 'imported') result.imported++;
      else result.updated++;
    } catch (err: any) {
      result.errors.push(`Schedule ${schedule.scheduleId}: ${err.message}`);
    }
  }
  return result;
}

/** Roda a sincronização pra toda empresa com integração Nibo ativa. Uso: cron. */
export async function syncNiboForAllCompanies(): Promise<NiboSyncResult[]> {
  const db = getDb();
  const credentials = await withDbTimeout(
    db
      .select({ companyId: integrationCredential.companyId, secretRef: integrationCredential.secretRef })
      .from(integrationCredential)
      .where(and(
        eq(integrationCredential.provider, 'nibo'),
        eq(integrationCredential.active, true),
        // Cliente encerrado não é mais sincronizado — ver 0065.
        sql`NOT EXISTS (SELECT 1 FROM company c WHERE c.id = ${integrationCredential.companyId} AND c.closed_at IS NOT NULL)`,
      )),
    8000,
  );

  const results: NiboSyncResult[] = [];
  for (const cred of credentials) {
    const encrypted = (cred.secretRef as { apiTokenEncrypted?: string } | null)?.apiTokenEncrypted;
    const apiToken = decryptSecret(encrypted);
    const empty = { companyId: cred.companyId, imported: 0, updated: 0, customersImported: 0, customersUpdated: 0 };
    if (!apiToken) {
      results.push({ ...empty, errors: ['Token do Nibo ausente/ilegível.'] });
      continue;
    }
    try {
      results.push(await syncNiboForCompany(cred.companyId, apiToken));
    } catch (err: any) {
      results.push({ ...empty, errors: [err.message] });
    }
  }
  return results;
}
