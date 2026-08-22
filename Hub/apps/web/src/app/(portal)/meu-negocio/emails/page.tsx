import { EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { getTenantContext } from '@/lib/server/tenant';
import { createClient } from '@supabase/supabase-js';
import { HubEmails } from './HubEmails';

export const dynamic = 'force-dynamic';

async function getCustomers() {
  try {
    const ctx = await getTenantContext();
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await sb
      .from('customer')
      .select('id, name, document, email, phone, type, address')
      .eq('company_id', ctx.companyId)
      .order('name');
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const ctx = await getTenantContext();
  const customers = await getCustomers();

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
