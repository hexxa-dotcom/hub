import {  Handshake  } from '@phosphor-icons/react/dist/ssr';
import { HubRelacionamento, type Customer } from './HubRelacionamento';
import { makeContractSignatureService } from '@/lib/server/container';
import { withTenant, sql } from '@hexxa/db';
import { listTarefasAction } from './actions';

export const dynamic = 'force-dynamic';

import { getTenantContext } from '@/lib/server/tenant';

async function getCustomers(companyId: string) {
  try {
    const data = await withTenant(companyId, async (tx) => {
      return tx.execute(sql`
        SELECT id, name, document, email, phone, type, address
        FROM customer
        WHERE company_id = ${companyId}
        ORDER BY name
      `);
    });
    return (data as unknown) as Customer[];
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

async function getBusinessContracts() {
  try {
    const ctx = await getTenantContext();
    const data = await withTenant(ctx.companyId, async (tx) => {
      return await tx.execute(sql`
        SELECT
          c.id, c.customer_id, cu.name as customer_name, c.title as tipo, c.value as valor,
          c.status, c.created_at as inicio, c.end_date as fim, c.notes as observacoes
        FROM contract c
        LEFT JOIN customer cu ON cu.id = c.customer_id
        WHERE c.company_id = ${ctx.companyId}
      `);
    });
    const today = new Date();
    return data.map((r: any) => {
      const fim = r.fim ? new Date(r.fim).toISOString().split('T')[0]! : null;
      let status: 'ativo' | 'rascunho' | 'expirado' | 'renovar' = 'ativo';
      if (r.status !== 'ACTIVE') {
        status = r.status === 'DRAFT' ? 'rascunho' : 'expirado';
      } else if (fim) {
        const end = new Date(fim);
        const days = (end.getTime() - today.getTime()) / 86_400_000;
        status = days < 0 ? 'expirado' : days <= 30 ? 'renovar' : 'ativo';
      }
      return {
        id: r.id,
        clienteId: r.customer_id,
        clienteNome: r.customer_name || 'Desconhecido',
        tipo: r.tipo,
        inicio: new Date(r.inicio).toISOString().split('T')[0]!,
        fim,
        valor: Number(r.valor),
        observacoes: r.observacoes ?? null,
        status,
      };
    });
  } catch {
    return [];
  }
}

export default async function Page() {
  const ctx = await getTenantContext();
  const [customers, contracts, businessContracts, tarefas] = await Promise.all([
    getCustomers(ctx.companyId),
    getContracts(),
    getBusinessContracts(),
    listTarefasAction(),
  ]);

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

      <HubRelacionamento companyId={ctx.companyId} initialCustomers={customers} initialContracts={contracts} initialBusinessContracts={businessContracts} initialTarefas={tarefas} />
    </div>
  );
}
