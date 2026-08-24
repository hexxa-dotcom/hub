import { Handshake, Sparkles } from 'lucide-react';
import { HubRelacionamento, type Customer } from './HubRelacionamento';
import { makeContractSignatureService } from '@/lib/server/container';
import { withTenant, sql } from '@hexxa/db';
import { listTarefasAction } from './actions';
import { getTenantContext } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

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
  } catch (err) {
    console.error('[relacionamento/page] falha ao listar clientes:', err);
    return [];
  }
}

async function getContracts() {
  try {
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    return await service.list(ctx);
  } catch (err) {
    console.error('[relacionamento/page] falha ao listar assinaturas:', err);
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
  } catch (err) {
    console.error('[relacionamento/page] falha ao listar contratos comerciais:', err);
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Handshake className="h-3.5 w-3.5" />
              Meu Negócio
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Relacionamento &amp; CRM
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gestão unificada de clientes, pipeline de tarefas, contratos e consultas à Receita Federal.
          </p>
        </div>
      </header>

      <HubRelacionamento
        companyId={ctx.companyId}
        initialCustomers={customers}
        initialContracts={contracts}
        initialBusinessContracts={businessContracts}
        initialTarefas={tarefas}
      />
    </div>
  );
}

