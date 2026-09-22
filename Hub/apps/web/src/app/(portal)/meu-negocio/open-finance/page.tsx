import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, Metric } from '@/components/ui/Card';
import { SectionHero } from '@/components/ui/SectionHero';
import { Bank, ShieldCheck, ArrowsClockwise, Sparkle, ArrowRight } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = { title: 'Open Finance · Hexxa Hub' };

/**
 * Open Finance — página de antecipação.
 *
 * A integração de extrato ainda não existe: a porta (`OpenFinancePort`) está
 * definida e nenhum adaptador a implementa. Esta tela existe para dizer isso
 * com todas as letras, e não para simular um recurso.
 *
 * Por que ela vale a pena mesmo vazia: é o extrato bancário que destrava a
 * única verificação do fechamento que confronta o sistema com o mundo real.
 * Hoje o parecer do fechamento diz literalmente "nada confronta a escrituração
 * com o dinheiro real" — e o empresário merece saber que isso tem solução
 * prevista, em vez de encontrar a lacuna sozinho.
 */

const RECURSOS = [
  {
    icon: ArrowsClockwise,
    titulo: 'Extrato que chega sozinho',
    texto:
      'As transações das suas contas entram no Hub todo dia, sem exportar OFX nem digitar nada. ' +
      'Hoje o extrato só existe se alguém lançar à mão.',
  },
  {
    icon: Sparkle,
    titulo: 'Conciliação automática',
    texto:
      'A IA casa cada transação com o lançamento correspondente e classifica o que sobrou. ' +
      'O motor já está pronto e testado — falta o extrato para ele trabalhar em cima.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Fechamento que confere com o banco',
    texto:
      'Com saldo real, o fechamento passa a comparar a escrituração contra o dinheiro que existe. ' +
      'É a única conferência que olha para fora do sistema.',
  },
];

export default function OpenFinancePage() {
  return (
    <div className="space-y-16 animate-fade-up">
      <SectionHero
        title="Open Finance"
        infoTitle="Sobre Open Finance"
        infoDescription="Conexão direta com as contas bancárias da empresa para conciliação automática e extratos em tempo real."
        rightSlot={
          <span className="rounded-full bg-hexxa-forest/10 dark:bg-hexxa-lime/10 border border-hexxa-forest/20 dark:border-hexxa-lime/20 px-3.5 py-1 text-xs font-bold text-hexxa-forest dark:text-hexxa-lime">
            Em breve
          </span>
        }
      />

      <Card level={3} tone="deep" className="flex flex-col gap-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <CardHeader label="O que muda quando ligar" icon={Bank} />
            <Metric value="Conciliação sem digitação" size="title" className="mt-4" />
            <p className="text-callout text-ink-soft mt-4">
              O Hub já sabe conciliar, classificar e escriturar. O que falta é a fonte:
              enquanto o extrato não chega sozinho, cada transação depende de alguém lançar.
            </p>
          </div>

          <div className="min-w-0 lg:border-l lg:border-ink/10 lg:pl-8">
            <p className="text-caption uppercase text-ink-soft">Enquanto não chega</p>
            <ul className="mt-3 space-y-3">
              <li className="text-footnote text-ink-soft">
                A conciliação funciona com lançamentos registrados no Hub.
              </li>
              <li className="text-footnote text-ink-soft">
                O fechamento avisa que não há saldo bancário para conferir — e essa
                é a lacuna que o Open Finance fecha.
              </li>
            </ul>
            <Link
              href="/meu-negocio/conciliacao"
              className="tap-target pressable focusable mt-6 inline-flex items-center gap-1.5 text-footnote font-semibold text-hexxa-green dark:text-hexxa-lime"
            >
              Ir para a conciliação
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {RECURSOS.map((r) => (
          <Card key={r.titulo} level={1} className="flex flex-col gap-3">
            <CardHeader label={r.titulo} icon={r.icon} />
            <p className="text-footnote text-ink-soft">{r.texto}</p>
          </Card>
        ))}
      </div>

      <Card level={1} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-heading text-ink">Quer ser avisado quando estiver pronto?</p>
          <p className="text-footnote text-ink-soft mt-1">
            Fale com a gente pelo suporte — assim entramos em contato assim que a conexão abrir.
          </p>
        </div>
        <Link
          href="/suporte"
          className="tap-target pressable focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-hexxa-green-dark px-5 py-2.5 text-footnote font-semibold text-hexxa-cream transition-colors hover:bg-hexxa-green"
        >
          Falar com o suporte
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
    </div>
  );
}
