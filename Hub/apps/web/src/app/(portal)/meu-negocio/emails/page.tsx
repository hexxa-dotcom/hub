import { EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { getTenantContext } from '@/lib/server/tenant';
import type { TenantContext } from '@hexxa/core';
import { withTenant, sql } from '@hexxa/db';
import { HubEmails, type Customer } from './HubEmails';

export const dynamic = 'force-dynamic';

async function getCustomers(ctx: TenantContext) {
  try {
    const data = await withTenant(ctx.companyId, async (tx) => {
      return tx.execute(sql`
        SELECT id, name, document, email, phone, type, address
        FROM customer
        WHERE company_id = ${ctx.companyId}
        ORDER BY name
      `);
    });
    return data as unknown as Customer[];
  } catch (err) {
    console.error('[meu-negocio/emails/page] falha ao listar clientes:', err);
    return [];
  }
}

export default async function Page() {
  const ctx = await getTenantContext();
  const customers = await getCustomers(ctx);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <EnvelopeSimple className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Caixa de E-mail CRM</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie e envie e-mails profissionais conectados ao cadastro dos seus clientes.
        </p>
      </header>

      <HubEmails companyId={ctx.companyId} initialCustomers={customers} />
    </div>
  );
}
