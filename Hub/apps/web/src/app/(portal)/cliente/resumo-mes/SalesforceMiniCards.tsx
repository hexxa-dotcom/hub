'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function SalesforceMiniCards({
  lucroIsento,
  contasPagarAbertas,
  qtdPagarAbertas,
  notasEmitidas,
}: {
  lucroIsento: number;
  contasPagarAbertas: number;
  qtdPagarAbertas: number;
  notasEmitidas: number;
}) {
  const cards = [
    {
      title: 'Retiradas de Pró-labore e Lucro',
      status: `${BRL.format(lucroIsento)} disponível`,
      subtitle: 'Isento de IRPF para os sócios',
      href: '/minha-contabilidade/socios',
    },
    {
      title: 'Contas e Obrigações a Pagar',
      status: `${qtdPagarAbertas} pendência${qtdPagarAbertas === 1 ? '' : 's'} (${BRL.format(contasPagarAbertas)})`,
      subtitle: 'Vencimentos previstos para o mês',
      href: '/meu-negocio/contas-a-pagar',
    },
    {
      title: 'Notas Fiscais Emitidas',
      status: `${notasEmitidas} nota${notasEmitidas === 1 ? '' : 's'} autorizada${notasEmitidas === 1 ? '' : 's'}`,
      subtitle: 'Consolidado fiscal e tributário',
      href: '/minha-contabilidade/guias',
    },
  ];

  return (
    <div className="flex flex-col gap-3.5 h-full justify-between">
      {cards.map((c, i) => (
        <Link
          key={i}
          href={c.href as never}
          className="relative overflow-hidden rounded-2xl bg-white/75 dark:bg-[#151916]/75 backdrop-blur-xl border border-white/70 dark:border-white/10 ring-1 ring-inset ring-white/60 dark:ring-white/5 p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex items-center justify-between gap-3 group hover:border-[#D4FF00] hover:shadow-md transition-all flex-1"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {c.title}
            </p>
            <p className="font-serif text-base sm:text-lg font-bold text-ink tabular mt-0.5">
              {c.status}
            </p>
            <p className="text-[11px] text-ink-soft mt-0.5">
              {c.subtitle}
            </p>
          </div>

          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-white/10 text-ink shadow-xs group-hover:bg-[#0E1310] group-hover:text-[#D4FF00] transition-all">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
