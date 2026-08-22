import {  Handshake  } from '@phosphor-icons/react/dist/ssr';
import { HubRelacionamento } from './HubRelacionamento';
import { makeContractSignatureService } from '@/lib/server/container';
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
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    return await service.list(ctx);
  } catch {
    return [];
  }
}

import { withTenant, sql } from '@hexxa/db';

async function getBusinessContracts() {
  try {
    const ctx = await getTenantContext();
    const data = await withTenant(ctx.companyId, async (tx) => {
      return await tx.execute(sql`
        SELECT 
          c.id, c.customer_id, cu.name as customer_name, c.title as tipo, c.value as valor, 
          c.status, c.created_at as inicio
        FROM contract c
        LEFT JOIN customer cu ON cu.id = c.customer_id
        WHERE c.company_id = ${ctx.companyId}
      `);
    });
    return data.map((r: any) => ({
      id: r.id,
      clienteId: r.customer_id,
      clienteNome: r.customer_name || 'Desconhecido',
      tipo: r.tipo,
      inicio: new Date(r.inicio).toISOString().split('T')[0]!,
      fim: new Date(new Date(r.inicio).getTime() + 365*24*60*60*1000).toISOString().split('T')[0]!,
      valor: Number(r.valor),
      observacoes: null,
      status: (r.status === 'ACTIVE' ? 'ativo' : r.status === 'DRAFT' ? 'rascunho' : 'expirado') as 'ativo' | 'rascunho' | 'expirado' | 'renovar',
    }));
  } catch {
    return [];
  }
}

export default async function Page() {
  const ctx = await getTenantContext();
  const [customers, contracts, businessContracts] = await Promise.all([getCustomers(), getContracts(), getBusinessContracts()]);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Handshake className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Relacionamento</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Clientes, contratos, gestão de e-mails e consulta de CNPJ em um só lugar.
        </p>
      </header>

      <HubRelacionamento companyId={ctx.companyId} initialCustomers={customers} initialContracts={contracts} initialBusinessContracts={businessContracts} />
    </div>
  );
}
