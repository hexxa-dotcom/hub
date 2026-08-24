import { FileCode, ShieldCheck, AlertTriangle } from 'lucide-react';
import { CertificadoDigitalForm } from './CertificadoDigitalForm';

export const metadata = {
  title: 'Configurações Fiscais | Hexxa Hub',
};

export default function FiscalPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <FileCode className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Padrões de Faturamento (NFS-e)</h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Configurações globais para emissão automática de notas fiscais de serviço.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-6 text-center">
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Perfis de Serviço e alíquotas automáticas de ISS configuradas pelo painel fiscal da contabilidade.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3 border-b border-black/5 dark:border-white/10 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Certificado Digital</h2>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Gerencie o certificado A1 usado para assinar e transmitir suas NFS-e para a prefeitura.</p>
          </div>
        </div>

        <CertificadoDigitalForm />
      </div>
    </div>
  );
}

