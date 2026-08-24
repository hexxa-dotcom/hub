import { FileSignature } from 'lucide-react';
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <FileSignature className="h-3.5 w-3.5" />
              Gestão Jurídica
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Gestão de Contratos de Serviços
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gerencie contratos de receita (clientes) e despesa (fornecedores), emissão de NFSe, cobranças Pix e assinaturas digitais.
          </p>
        </div>
      </header>

      <ContratosClient initialDocs={initialDocs} initialContracts={initialContracts} />
    </div>
  );
}

