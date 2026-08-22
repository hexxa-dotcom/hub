import { ContratosClient } from './ContratosClient';
import { makeContractSignatureService } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { listContractsAction } from './actions';

export const dynamic = 'force-dynamic';

async function getSignatureRequests() {
  try {
    const ctx = await getTenantContext();
    const service = makeContractSignatureService();
    return await service.list(ctx);
  } catch (err) {
    console.error('[meu-negocio/contratos/page] falha ao listar assinaturas:', err);
    return [];
  }
}

export default async function Page() {
  const [initialDocs, initialContracts] = await Promise.all([getSignatureRequests(), listContractsAction()]);

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Gestão de Contratos de Serviços</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie contratos de receita (clientes) e despesa (fornecedores), emissão de NFSe, cobranças Pix e assinaturas digitais.
        </p>
      </header>

      <ContratosClient initialDocs={initialDocs} initialContracts={initialContracts} />
    </div>
  );
}
