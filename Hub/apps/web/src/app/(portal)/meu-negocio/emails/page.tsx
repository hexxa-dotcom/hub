import { Mail } from 'lucide-react';
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Mail className="h-3.5 w-3.5" />
              Comunicação
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Central de E-mails CRM
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gerencie e envie e-mails profissionais conectados diretamente ao cadastro dos seus clientes.
          </p>
        </div>
      </header>

      <HubEmails companyId={ctx.companyId} initialCustomers={customers} />
    </div>
  );
}

