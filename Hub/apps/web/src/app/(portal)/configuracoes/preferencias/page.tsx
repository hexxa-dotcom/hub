import { DashboardPreferencesForm } from './DashboardPreferencesForm';

export const metadata = {
  title: 'Preferências da Tela Inicial | Hexx Hub',
};

export default function PreferenciasPage() {
  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6">
          <h2 className="text-lg font-semibold leading-tight text-ink">Personalizar Tela Inicial</h2>
          <p className="text-sm text-ink-soft">Escolha os componentes visíveis e a quantidade de meses do gráfico histórico.</p>
        </div>

        <DashboardPreferencesForm />
      </div>
    </div>
  );
}
