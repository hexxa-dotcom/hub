import { ScanSearch } from 'lucide-react';
import { CnpjConsulta } from './CnpjConsulta';

export const metadata = { title: 'Consulta de CNPJ — Hexx Hub Digital' };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-brand-500" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Consulta de CNPJ</h1>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          Dados diretamente da Receita Federal via cnpja.com — razão social, endereço, contato, CNAE e muito mais.
        </p>
      </header>
      <CnpjConsulta />
    </div>
  );
}
