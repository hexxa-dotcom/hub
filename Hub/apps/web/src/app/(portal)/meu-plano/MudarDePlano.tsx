import Link from 'next/link';
import { Check } from 'lucide-react';
import { MODULOS, type ModuloDoPlano } from '@/lib/plano-acesso';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Convite para o plano completo, mostrado a quem está num plano com funções de
 * fora (Simples Light). É o destino do cadeado do menu.
 */
export function MudarDePlano({
  bloqueados,
  completo,
  whatsappUrl,
}: {
  bloqueados: ModuloDoPlano[];
  completo: { nome: string; valor: number; recursos: string[] };
  whatsappUrl: string | null;
}) {
  return (
    <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-[#121614]">
      <p className="rotulo text-ink-soft">Quer mais?</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">
        Plano {completo.nome} · {BRL.format(completo.valor)}/mês
      </h2>
      <p className="mt-1 text-sm text-ink-soft">Tudo do seu plano atual, sem limite de notas, e mais:</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {bloqueados.map((m) => (
          <li key={m} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{MODULOS[m].nome}</strong> — <span className="text-ink-soft">{MODULOS[m].oQueFaz}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={(whatsappUrl ?? '/suporte') as never}
        target={whatsappUrl ? '_blank' : undefined}
        className="mt-6 inline-flex rounded-full bg-[#1E3328] px-6 py-3 text-sm font-semibold text-[#DFFFAE] transition-colors hover:bg-[#2F4A3C]"
      >
        Quero mudar para o {completo.nome}
      </Link>
    </section>
  );
}
