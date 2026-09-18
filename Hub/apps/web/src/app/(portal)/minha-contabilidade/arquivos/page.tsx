import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { listDocumentsAction } from './actions';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const docs = await listDocumentsAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Documentos da Empresa
            </h1>
            <SectionInfo
              title="Sobre os Documentos da Empresa"
              description="Repositório centralizado do cartão CNPJ, contrato social, alvarás, documentos dos sócios e certidões negativas (CNDs)."
            />
          </div>
        </div>
      </Card>

      <ArquivosClient initialDocs={docs} />
    </div>
  );
}

