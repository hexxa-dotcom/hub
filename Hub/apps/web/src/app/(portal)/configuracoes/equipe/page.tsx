import { Users, UserPlus } from 'lucide-react';

export const metadata = {
  title: 'Equipe e Acessos | Hexxa Hub',
};

export default function EquipePage() {
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
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Gerencie quem pode visualizar lançamentos contábeis e gerenciar notas fiscais.</p>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
            <UserPlus className="h-4 w-4" /> Convidar Membro
          </button>
        </div>

        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-8 text-center">
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Gestão de permissões granulares por função (Administrador, Financeiro, Consulta).
          </p>
        </div>
      </div>
    </div>
  );
}

