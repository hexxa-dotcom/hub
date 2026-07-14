import { Handshake } from 'lucide-react';
import { HubRelacionamento } from './HubRelacionamento';
import { listDocuments } from '@/lib/autentique';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

import { getTenantContext } from '@/lib/server/tenant';

async function getCustomers() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await sb
      .from('customer')
      .select('id, name, document, email, phone, type, address')
      .eq('company_id', (await getTenantContext()).companyId)
      .order('name');
    return data ?? [];
  } catch {
    return [];
  }
}

async function getContracts() {
  try {
    return await listDocuments();
  } catch {
    return [];
  }
}

export default async function Page() {
  const [customers, contracts] = await Promise.all([getCustomers(), getContracts()]);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Handshake className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Relacionamento</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Clientes, contratos e consulta de CNPJ em um só lugar.
        </p>
      </header>

      <HubRelacionamento initialCustomers={customers} initialContracts={contracts} />
    </div>
  );
}
