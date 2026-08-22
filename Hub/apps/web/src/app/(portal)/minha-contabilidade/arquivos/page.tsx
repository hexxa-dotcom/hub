import { FileText } from '@phosphor-icons/react/dist/ssr';
import { listDocumentsAction } from './actions';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const docs = await listDocumentsAction();

  return (
    <div className="mx-auto w-full space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-500" />
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Arquivos Permanentes</h1>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            Documentos da empresa sempre à mão — alvarás, contratos, CNDs e mais.
          </p>
        </div>
      </header>

      <ArquivosClient initialDocs={docs} />
    </div>
  );
}
