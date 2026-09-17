import { SettingsNav } from './SettingsNav';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Configurações | Hexxa Hub',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in">
      <Card level={2} tone="deep" className="card-finish p-6 sm:p-8">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Configurações & Integrações
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Gerencie os dados cadastrais da sua empresa, equipe, conexões fiscais e preferências do sistema.
          </p>
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
