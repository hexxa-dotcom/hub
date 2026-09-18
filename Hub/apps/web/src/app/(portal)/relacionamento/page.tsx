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

import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

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
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Relacionamento &amp; CRM
            </h1>
            <SectionInfo
              title="Sobre Relacionamento & CRM"
              description="Gestão unificada de clientes, pipeline de tarefas, contratos e consultas à Receita Federal."
            />
          </div>
        </div>
      </Card>

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

