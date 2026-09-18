import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { listDocumentsAction } from './actions';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const docs = await listDocumentsAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre os Documentos da Empresa"
            description="Repositório centralizado do cartão CNPJ, contrato social, alvarás, documentos dos sócios e certidões negativas (CNDs)."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Documentos da Empresa
            </h1>
          </div>
        </div>
      </Card>

      <ArquivosClient initialDocs={docs} />
    </div>
  );
}

