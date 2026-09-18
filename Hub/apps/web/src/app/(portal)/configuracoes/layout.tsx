import { SettingsNav } from './SettingsNav';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';

export const metadata = {
  title: 'Configurações | Hexxa Hub',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="relative z-30 min-h-[96px] sm:min-h-[104px] px-6 sm:px-8 card-finish flex items-center">
        <div className="flex items-center justify-between gap-6 w-full">
          <SectionInfo
            title="Sobre Configurações & Integrações"
            description="Gerencie os dados cadastrais da sua empresa, equipe, conexões fiscais e preferências do sistema."
          />
          <div className="shrink-0 pr-4 sm:pr-8 lg:pr-12">
            <h1 className="font-bold text-3xl sm:text-4xl text-ink tracking-tight text-right">
              Configurações &amp; Integrações
            </h1>
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
