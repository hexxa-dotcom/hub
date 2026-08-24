import { SlidersHorizontal } from 'lucide-react';
import { SettingsNav } from './SettingsNav';

export const metadata = {
  title: 'Configurações | Hexxa Hub',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Painel de Ajustes
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            Configurações & Integrações
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Gerencie os dados cadastrais da sua empresa, equipe, conexões fiscais e preferências do sistema.
          </p>
        </div>
      </header>

      <SettingsNav />

      {/* Conteúdo da Aba */}
      <div className="pt-1">
        {children}
      </div>
    </div>
  );
}

