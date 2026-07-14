import { FileSignature } from 'lucide-react';
import { ContratosClient } from './ContratosClient';
import { listDocuments, type AutentiqueDocument } from '@/lib/autentique';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let docs: AutentiqueDocument[] = [];
  try {
    docs = await listDocuments();
  } catch {
    // Mostra lista vazia se API falhar
  }

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Contratos</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Envie contratos em PDF para assinatura digital com validade jurídica via Autentique.
        </p>
      </header>

      <ContratosClient initial={docs} />
    </div>
  );
}
