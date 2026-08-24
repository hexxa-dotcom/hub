import { DashboardPreferencesForm } from './DashboardPreferencesForm';
import { QuickActionsPreferencesForm } from './QuickActionsPreferencesForm';

export const metadata = {
  title: 'Preferências da Tela Inicial | Hexxa Hub',
};

export default function PreferenciasPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="mb-6 border-b border-black/5 dark:border-white/10 pb-4">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Personalizar Tela Inicial</h2>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Escolha os componentes visíveis e a quantidade de meses do gráfico histórico.</p>
        </div>

        <DashboardPreferencesForm />
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <QuickActionsPreferencesForm />
      </div>
    </div>
  );
}

