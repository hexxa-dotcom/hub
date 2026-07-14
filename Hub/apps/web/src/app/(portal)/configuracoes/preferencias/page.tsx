import { SlidersHorizontal, Moon, Bell } from 'lucide-react';

export const metadata = {
  title: 'Preferências | Hexx Hub',
};

export default function PreferenciasPage() {
  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-ink">Preferências</h2>
            <p className="text-sm text-ink-soft">Configurações de interface e notificações.</p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-hover p-4 text-center">
          <p className="text-sm text-ink-soft">
            Preferências de tema e notificações estarão disponíveis em breve.
          </p>
        </div>
      </div>
    </div>
  );
}
