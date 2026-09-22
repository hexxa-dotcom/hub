import { SectionHero } from '@/components/ui/SectionHero';
import { listDocumentsAction } from './actions';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const docs = await listDocumentsAction();

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        title="Documentos da Empresa"
        infoTitle="Sobre os Documentos da Empresa"
        infoDescription="Repositório centralizado do cartão CNPJ, contrato social, alvarás, documentos dos sócios e certidões negativas (CNDs)."
      />

      <ArquivosClient initialDocs={docs} />
    </div>
  );
}

