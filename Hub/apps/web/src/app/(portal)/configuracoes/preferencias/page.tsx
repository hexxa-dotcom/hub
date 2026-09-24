import { DashboardPreferencesForm } from './DashboardPreferencesForm';
import { QuickActionsPreferencesForm } from './QuickActionsPreferencesForm';
import { Card } from '@/components/ui/Card';

export const metadata = {
  title: 'Preferências da Tela Inicial | Hexx Digital',
};

export default function PreferenciasPage() {
  return (
    <div className="space-y-6">
      <Card level={1} className="p-6 sm:p-8">
        <div className="mb-6 border-b border-black/5 dark:border-white/10 pb-4">
          <h2 className="font-serif font-bold text-base text-ink">Personalizar Tela Inicial</h2>
          <p className="text-xs text-ink-soft">Escolha os componentes visíveis e a quantidade de meses do gráfico histórico.</p>
        </div>

        <DashboardPreferencesForm />
      </Card>

      <Card level={1} className="p-6 sm:p-8">
        <QuickActionsPreferencesForm />
      </Card>
    </div>
  );
}
