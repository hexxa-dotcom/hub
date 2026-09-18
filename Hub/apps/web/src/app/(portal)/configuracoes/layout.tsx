import { SettingsNav } from './SettingsNav';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata = {
  title: 'Configurações | Hexxa Hub',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 card-finish p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">
              Configurações &amp; Integrações
            </h1>
            <SectionInfo
              title="Sobre Configurações & Integrações"
              description="Gerencie os dados cadastrais da sua empresa, equipe, conexões fiscais e preferências do sistema."
            />
          </div>
        </div>
      </Card>

      <SettingsNav />

      {/* Conteúdo da Aba */}
      <div className="pt-1">
        {children}
      </div>
    </div>
  );
}
