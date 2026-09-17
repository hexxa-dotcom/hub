import { Card } from '@/components/ui/Card';
import { listDocumentsAction } from './actions';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const docs = await listDocumentsAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <Card level={2} tone="deep" className="p-6 sm:p-8 card-finish">
        <h1 className="font-serif font-bold text-display text-ink tracking-tight">
          Documentos da Empresa
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Repositório centralizado do cartão CNPJ, contrato social, alvarás, documentos dos sócios e certidões negativas (CNDs).
        </p>
      </Card>

      <ArquivosClient initialDocs={docs} />
    </div>
  );
}

