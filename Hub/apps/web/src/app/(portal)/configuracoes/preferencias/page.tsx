import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { QuickActionsPreferencesForm } from './QuickActionsPreferencesForm';
import { PerfilDoInicio } from '../../cliente/PerfilDoInicio';
import { blocosDoPerfil, ehPerfil } from '../../cliente/blocos';

export const metadata = { title: 'Preferências | Hexx Digital' };
export const dynamic = 'force-dynamic';

export default async function PreferenciasPage() {
  const ctx = await getTenantContext();
  const [p] = (await getDb()
    .execute(sql`SELECT inicio_perfil AS perfil, inicio_blocos AS blocos FROM company WHERE id = ${ctx.companyId}`)
    .catch(() => [])) as unknown as { perfil: string; blocos: string[] | null }[];
  const perfil = ehPerfil(p?.perfil) ? p.perfil : 'BASICO';

  return (
    <div className="space-y-12">
      <section id="visao-da-inicio" className="scroll-mt-24">
        <h3 className="text-sm font-semibold text-ink">Visão da Início</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Quanto a tela de Início mostra. Básico traz só o essencial; Completo, todos os números e gráficos; no Personalizado você escolhe.
        </p>
        <PerfilDoInicio perfil={perfil} visiveis={blocosDoPerfil(perfil, p?.blocos)} emLinha />
      </section>

      <QuickActionsPreferencesForm />
    </div>
  );
}
