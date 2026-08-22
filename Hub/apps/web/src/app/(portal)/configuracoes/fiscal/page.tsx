import {  FileCode, ShieldCheck, Warning  } from '@phosphor-icons/react/dist/ssr';
import { CertificadoDigitalForm } from './CertificadoDigitalForm';

export const metadata = {
  title: 'Configurações Fiscais | Hexx Hub',
};

export default function FiscalPage() {
  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <FileCode className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-ink">Padrões de Faturamento (NFSe)</h2>
            <p className="text-sm text-ink-soft">Configurações globais para emissão automática de notas fiscais.</p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-hover p-4 text-center">
          <p className="text-sm text-ink-soft">
            Perfis de Serviço e ISS serão configurados aqui em breve.
          </p>
        </div>
      </div>

      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-ink">Certificado Digital</h2>
            <p className="text-sm text-ink-soft">Gerencie o certificado A1/A3 usado para assinar e transmitir suas NFSe.</p>
          </div>
        </div>

        <CertificadoDigitalForm />
      </div>
    </div>
  );
}
