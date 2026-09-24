import { SettingsNav } from './SettingsNav';
import { SectionHero } from '@/components/ui/SectionHero';

export const metadata = {
  title: 'Configurações | Hexx Digital',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 animate-fade-up">
      <SectionHero
        subtitulo="Cadastro da empresa, equipe, integrações e preferências"
        title="Configurações & Integrações"
        infoTitle="Sobre Configurações & Integrações"
        infoDescription="Gerencie os dados cadastrais da sua empresa, equipe, conexões fiscais e preferências do sistema."
      />

      <div className="space-y-8">
        <SettingsNav />

        {/* Conteúdo da Aba */}
        <div className="pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
