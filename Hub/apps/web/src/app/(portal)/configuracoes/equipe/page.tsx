import { Users } from 'lucide-react';
import { listMembersAction } from './actions';
import { EquipeClient } from './EquipeClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Equipe e Acessos | Hexxa Hub',
};

export default async function EquipePage() {
  const members = await listMembersAction();

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Gestão de Membros & Permissões</h2>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Gerencie quem pode acessar esta empresa e com qual papel.</p>
            </div>
          </div>
        </div>

        <EquipeClient members={members} />
      </div>
    </div>
  );
}
