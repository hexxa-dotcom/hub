import { listMembersAction } from './actions';
import { EquipeClient } from './EquipeClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Equipe e Acessos | Hexx Digital' };

export default async function EquipePage() {
  const members = await listMembersAction();
  return (
    <section className="space-y-5">
      <div>
        <p className="rotulo text-ink-soft">Quem acessa esta empresa</p>
        <p className="mt-1 text-sm text-ink-soft">Convide pelo e-mail e escolha o papel de cada pessoa.</p>
      </div>
      <EquipeClient members={members} />
    </section>
  );
}
