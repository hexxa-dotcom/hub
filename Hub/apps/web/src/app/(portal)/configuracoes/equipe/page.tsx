import { Users } from 'lucide-react';
import { listMembersAction } from './actions';
import { EquipeClient } from './EquipeClient';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Equipe e Acessos | Hexxa Hub',
};

export default async function EquipePage() {
  const members = await listMembersAction();

  return (
    <div className="space-y-6">
      <Card level={1} className="p-6 sm:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hexxa-forest/15 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-serif font-bold text-base text-ink">Gestão de Membros & Permissões</h2>
              <p className="text-xs text-ink-soft">Gerencie quem pode acessar esta empresa e com qual papel.</p>
            </div>
          </div>
        </div>

        <EquipeClient members={members} />
      </Card>
    </div>
  );
}
