import Link from 'next/link';
import { BarChart3, Scale, Users, Clock, Sparkles, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

const REPORTS: { href: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    href: '/meu-negocio/relatorios/faturamento',
    icon: BarChart3,
    title: 'Faturamento',
    description: 'Receita por mês ou por ano — visão mensal detalhada ou comparativo entre anos.',
  },
  {
    href: '/meu-negocio/relatorios/faturamento-por-cliente',
    icon: Users,
    title: 'Faturamento por Cliente',
    description: 'Quanto cada cliente representou no ano, com participação % e margem estimada.',
  },
  {
    href: '/meu-negocio/relatorios/balanco',
    icon: Scale,
    title: 'Balanço e DRE',
    description: 'Resultado do período em tempo real — receita, despesas e lucro líquido, com histórico de 12 meses.',
  },
  {
    href: '/meu-negocio/relatorios/fechamento',
    icon: Clock,
    title: 'Fechamento Mensal',
    description: 'O fechamento oficial gerado no início de cada mês, com indicadores e alertas contábeis.',
  },
];

export default function RelatoriosHubPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 animate-fade-up">
      <header className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
          <Sparkles className="h-3.5 w-3.5" /> Relatórios
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
          O que você quer visualizar?
        </h1>
        <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-xl">
          Escolha um relatório abaixo — todos gerados em tempo real a partir dos lançamentos já no sistema.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href as never}
            className="group rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1A201C] p-6 shadow-sm hover:border-black/10 dark:hover:border-white/20 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#EFFFD6] dark:bg-[#1E3328] p-2.5">
                <r.icon className="h-5 w-5 text-[#1E3328] dark:text-[#DFFFAE]" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#6E6A61] dark:text-[#A8A49C] group-hover:translate-x-1 transition-transform" />
            </div>
            <h2 className="mt-4 font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">{r.title}</h2>
            <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
