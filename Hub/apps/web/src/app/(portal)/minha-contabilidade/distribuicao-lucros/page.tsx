import { HandCoins, Users } from 'lucide-react';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';
import { DistForm } from './DistForm';
import { LucroCard } from './LucroCard';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const YEAR = new Date().getFullYear();

type Dist = {
  id: string;
  partner_name: string;
  amount: number | string;
  distributed_at: string;
  notes: string | null;
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  let items: Dist[] = [];
  let dbReady = true;
  try {
    const ctx = await getTenantContext();
    const supabase = await createRawClient();
    const { data, error } = await supabase
      .from('profit_distribution')
      .select('id, partner_name, amount, distributed_at, notes')
      .eq('company_id', ctx.companyId)
      .order('distributed_at', { ascending: false });
    if (error) throw error;
    items = (data ?? []) as Dist[];
  } catch {
    dbReady = false;
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const partners = new Set(items.map((i) => i.partner_name)).size;

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Distribuição de Lucros</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Lance cada distribuição de lucro aos sócios. O total do ano fica visível para você e para a sua contabilidade.
        </p>
      </header>

      <LucroCard />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <section className="card-highlight rounded-card p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-white/85">Total distribuído em {YEAR}</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white">
              <HandCoins className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-tight text-white">{BRL.format(total)}</p>
          <p className="mt-1 text-xs text-white/70">{items.length} lançamento(s)</p>
        </section>

        <section className="card-flat rounded-card p-5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium text-ink-soft">Sócios contemplados</h3>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Users className="h-[18px] w-[18px]" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-semibold tracking-tight">{partners}</p>
          <p className="mt-1 text-xs text-ink-soft">no histórico</p>
        </section>
      </div>

      <DistForm />

      {!dbReady && (
        <p className="card-flat rounded-card p-4 text-sm text-warn">
          Não foi possível ler as distribuições do banco agora.
        </p>
      )}

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Distribuições</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nenhuma distribuição lançada ainda.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-2">Data</th>
                <th>Sócio</th>
                <th>Observação</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="py-2">{fmtDate(i.distributed_at)}</td>
                  <td>{i.partner_name}</td>
                  <td className="text-ink-soft">{i.notes ?? '—'}</td>
                  <td className="text-right font-medium">{BRL.format(Number(i.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <td className="py-2" colSpan={3}>
                  Total
                </td>
                <td className="text-right text-brand-600 dark:text-brand-300">{BRL.format(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Os lançamentos ficam disponíveis para a sua contabilidade automaticamente.
        </p>
      </section>
    </div>
  );
}
