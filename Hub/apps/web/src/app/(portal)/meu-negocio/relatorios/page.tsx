import Link from 'next/link';
import { BarChart3, Scale, Users, Clock, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';

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
    href: '/meu-negocio/relatorios/informe-rendimentos',
    icon: Users,
    title: 'Informe de Rendimentos',
    description: 'Lucros distribuídos a cada sócio no ano — para o Imposto de Renda pessoa física.',
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
    <div className="mx-auto w-full max-w-4xl space-y-16 animate-fade-up">
      <SectionHero
        subtitulo="Os números da empresa, prontos para ler e imprimir"
        title="Relatórios Financeiros"
        infoTitle="Sobre os Relatórios"
        infoDescription="Escolha um relatório abaixo — todos gerados em tempo real a partir dos lançamentos já no sistema."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href as never}
            className="group block"
          >
            <Card level={1} className="card-finish p-6 hover:shadow-(--elev-2) hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-2.5">
                  <r.icon className="h-5 w-5 text-hexxa-green dark:text-hexxa-lime" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-soft group-hover:text-ink group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="mt-4 font-serif font-bold text-lg text-ink">{r.title}</h2>
              <p className="mt-1 text-xs text-ink-soft">{r.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
