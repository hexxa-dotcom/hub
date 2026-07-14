import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@hexxa/db';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type PlanCard = Pick<Tables<'plan'>, 'id' | 'name' | 'monthly_value' | 'features'>;

/**
 * Meu Plano — lê os planos reais do banco via client Supabase tipado (@hexxa/db).
 * Foco em upsell. Sempre "valor mensal" (NUNCA "investimento").
 */
export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plan')
    .select('id, name, monthly_value, features')
    .order('monthly_value', { ascending: true });
  const plans = (data ?? []) as unknown as PlanCard[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Meu Plano</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Escolha o pacote ideal para o seu momento.
        </p>
      </header>

      {error && (
        <div className="card-flat rounded-[var(--radius-card)] p-4 text-sm text-[var(--color-critical)]">
          Não foi possível carregar os planos agora.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((plan, i) => {
          const highlight = i === plans.length - 1; // o mais completo em destaque
          return (
            <section
              key={plan.id}
              className={`rounded-[var(--radius-card)] p-6 ${highlight ? 'glass' : 'card-flat'}`}
            >
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-[var(--color-brand-600)]">
                {BRL.format(plan.monthly_value)}
                <span className="ml-1 text-sm font-medium text-[var(--color-ink-soft)]">
                  / valor mensal
                </span>
              </p>
              <ul className="mt-4 space-y-1 text-sm text-[var(--color-ink-soft)]">
                {Object.entries((plan.features as Record<string, unknown>) ?? {}).map(([k, v]) => (
                  <li key={k}>
                    {k}: <strong>{String(v)}</strong>
                  </li>
                ))}
              </ul>
              <button className="mt-6 w-full rounded-xl bg-[var(--color-brand-500)] px-4 py-2 font-medium text-white">
                {highlight ? 'Quero crescer' : 'Começar agora'}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
