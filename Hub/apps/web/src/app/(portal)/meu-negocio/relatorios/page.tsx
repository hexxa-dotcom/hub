import Link from 'next/link';
import { SectionHero } from '@/components/ui/SectionHero';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Relatórios · Hexx Digital' };

/**
 * RELATÓRIOS — os números da empresa prontos para ler, imprimir e mandar.
 *
 * Todos saem dos mesmos dados das telas: faturamento é só nota fiscal (como
 * na Bússola e nas Notas), e o imposto usa a mesma alíquota.
 */
const RELATORIOS: { href: string; titulo: string; descricao: string; grupo: string }[] = [
  { grupo: 'Faturamento', href: '/meu-negocio/relatorios/faturamento', titulo: 'Faturamento', descricao: 'As notas fiscais mês a mês e o comparativo entre anos.' },
  { grupo: 'Faturamento', href: '/meu-negocio/relatorios/faturamento-por-cliente', titulo: 'Faturamento por cliente', descricao: 'Quanto cada cliente representou no ano, com a participação de cada um.' },
  { grupo: 'Resultado', href: '/meu-negocio/relatorios/balanco', titulo: 'Balanço e DRE', descricao: 'Receita, despesas, imposto e lucro de um mês ou de um período, com os últimos 12 meses.' },
  { grupo: 'Resultado', href: '/meu-negocio/relatorios/fechamento', titulo: 'Fechamento mensal', descricao: 'O fechamento oficial de cada mês, com indicadores e alertas da contabilidade.' },
  { grupo: 'Sócios', href: '/meu-negocio/relatorios/informe-rendimentos', titulo: 'Informe de rendimentos', descricao: 'Pró-labore e lucros distribuídos a cada sócio no ano — para o Imposto de Renda.' },
];

export default function RelatoriosPage() {
  const grupos = Array.from(new Set(RELATORIOS.map((r) => r.grupo)));
  return (
    <div className="w-full space-y-12 pb-20">
      <SectionHero
        title="Relatórios"
        subtitulo="Os números da empresa, prontos para ler e imprimir"
        infoTitle="Sobre os relatórios"
        infoDescription="Todos gerados na hora a partir dos lançamentos e das notas. Faturamento é só nota fiscal, e o imposto é estimado com a mesma alíquota da Bússola Tributária."
      />
      {grupos.map((g) => (
        <section key={g} className="space-y-3">
          <p className="rotulo text-ink-soft">{g}</p>
          <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {RELATORIOS.filter((r) => r.grupo === g).map((r) => (
              <li key={r.href}>
                <Link href={r.href as never} className="flex items-center justify-between gap-6 px-6 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{r.titulo}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{r.descricao}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-ink-soft">Abrir</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
