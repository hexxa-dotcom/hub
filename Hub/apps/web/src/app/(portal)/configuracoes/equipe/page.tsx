import { Users, UserPlus } from 'lucide-react';

export const metadata = {
  title: 'Equipe e Acessos | Hexx Hub',
};

export default function EquipePage() {
  return (
    <div className="space-y-6">
      <div className="card-flat rounded-card p-6 border border-line bg-surface-card">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-ink">Equipe e Acessos</h2>
              <p className="text-sm text-ink-soft">Gerencie quem tem acesso aos dados da sua empresa.</p>
            </div>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <UserPlus className="h-4 w-4" /> Convidar Membro
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface-hover p-4 text-center">
          <p className="text-sm text-ink-soft">
            Módulo de gestão de acessos em desenvolvimento. Em breve você poderá convidar seus sócios e funcionários.
          </p>
        </div>
      </div>
    </div>
  );
}
