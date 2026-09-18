import Link from 'next/link';
import { getTenantContext } from '@/lib/server/tenant';
import { getInformeDeRendimentos } from '@/lib/server/informe-rendimentos';
import { Info, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SectionInfo } from '@/components/ui/SectionInfo';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');

/**
 * Informe de Rendimentos — o documento que o sócio usa no IRPF dele.
 *
 * A tela diz explicitamente o que o documento cobre e o que não cobre. Não é
 * excesso de zelo: um informe incompleto usado para preencher IRPF vira
 * declaração a menor, e o problema é do sócio com a Receita, não nosso.
 */
export default async function InformeRendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const ctx = await getTenantContext();
  const params = await searchParams;
  const ano = params.ano ? Number(params.ano) : undefined;

  const informe = await getInformeDeRendimentos(ctx, ano);
  const temProLabore = informe.socios.some((s) => s.temProLaboreConfigurado);
  const semCpf = informe.socios.filter((s) => s.lancamentos.length > 0 && !s.socio.cpf);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Card level={2} tone="deep" className="relative z-30 p-6 sm:p-7 card-finish print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link 
              href="/meu-negocio/relatorios" 
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-card border border-black/5 dark:border-white/5 px-3.5 py-1.5 text-xs font-bold text-ink-soft hover:text-ink shadow-(--elev-1) transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Relatórios
            </Link>
            <div className="flex items-center gap-2.5 mt-3">
              <h1 className="font-bold text-2xl sm:text-3xl text-ink tracking-tight">Lucros e Rendimentos</h1>
              <SectionInfo
                title="Sobre Lucros e Rendimentos"
                description={`Lucros distribuídos aos sócios em ${informe.ano}. O documento que o sócio usa na sua declaração de IRPF.`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {informe.anosDisponiveis.length > 1 && (
              <div className="flex gap-1 rounded-full border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) p-1">
                {informe.anosDisponiveis.map((a) => (
                  <Link
                    key={a}
                    href={`/meu-negocio/relatorios/informe-rendimentos?ano=${a}` as never}
                    className={`rounded-full px-3 py-1 text-footnote font-semibold transition-all ${
                      a === informe.ano
                        ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {a}
                  </Link>
                ))}
              </div>
            )}
            <PrintButton />
          </div>
        </div>
      </Card>

      <div className="rounded-3xl border border-line bg-surface-card shadow-(--elev-1) card-finish p-6 sm:p-8 print:border-0 print:p-0">
        <header className="border-b border-line pb-5">
          <p className="text-caption uppercase text-ink-soft">Fonte pagadora</p>
          <p className="text-heading text-ink mt-1">{informe.empresa.razaoSocial}</p>
          <p className="text-footnote text-ink-soft">CNPJ {informe.empresa.cnpj}</p>
          <p className="text-footnote text-ink-soft mt-2">
            Ano-calendário <strong className="text-ink">{informe.ano}</strong>
          </p>
        </header>

        {informe.socios.every((s) => s.lancamentos.length === 0) ? (
          <p className="text-callout text-ink-soft mt-6">
            Nenhuma distribuição de lucro registrada em {informe.ano}.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {informe.socios
              .filter((s) => s.lancamentos.length > 0)
              .map((s) => (
                <section key={s.socio.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-heading text-ink">{s.socio.nome}</p>
                      {s.socio.cpf ? (
                        <p className="text-footnote text-ink-soft">CPF {s.socio.cpf}</p>
                      ) : (
                        /* CPF é obrigatório no IRPF. Sem ele o informe não
                           serve, então a falta aparece — não fica escondida. */
                        <p className="text-footnote text-warn">
                          {s.naoCadastrado
                            ? 'Não está no cadastro de sócios — falta o CPF'
                            : 'CPF não cadastrado'}
                        </p>
                      )}
                    </div>
                    <p className="font-serif text-title2 tabular text-hexxa-green dark:text-hexxa-lime">
                      {BRL.format(s.totalDistribuido)}
                    </p>
                  </div>

                  <p className="text-caption uppercase text-ink-soft mt-4">
                    Rendimentos isentos e não tributáveis — lucros e dividendos
                  </p>

                  <table className="mt-2 w-full">
                    <tbody className="divide-y divide-line">
                      {s.lancamentos.map((l, i) => (
                        <tr key={`${l.data}-${i}`}>
                          <td className="py-2 text-footnote text-ink-soft">{dataBR(l.data)}</td>
                          <td className="py-2 text-footnote text-ink-soft">{l.observacao ?? '—'}</td>
                          <td className="py-2 text-right text-footnote tabular text-ink">
                            {BRL.format(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}

            <div className="flex items-baseline justify-between border-t border-ink/15 pt-5">
              <p className="text-heading text-ink">Total distribuído em {informe.ano}</p>
              <p className="font-serif text-title2 tabular text-ink">{BRL.format(informe.totalGeral)}</p>
            </div>
          </div>
        )}

        {semCpf.length > 0 && (
          <div className="mt-6 rounded-2xl border border-warn/30 bg-warn/5 p-4 print:hidden">
            <p className="text-footnote font-semibold text-ink">
              {semCpf.length === 1 ? 'Um beneficiário está' : `${semCpf.length} beneficiários estão`} sem
              CPF
            </p>
            <p className="text-footnote text-ink-soft mt-1">
              O CPF é obrigatório para usar este informe no Imposto de Renda. Cadastre{' '}
              {semCpf.map((s) => s.socio.nome).join(', ')} em{' '}
              <Link href="/minha-contabilidade/socios" className="font-semibold text-hexxa-green dark:text-hexxa-lime">
                Sócios
              </Link>
              .
            </p>
          </div>
        )}

        {/* O aviso não é rodapé decorativo: é o que impede o sócio de tratar um
            documento parcial como completo na hora de declarar. */}
        <div className="mt-8 flex gap-3 rounded-2xl border border-line bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <Info className="h-4 w-4 shrink-0 text-ink-soft mt-0.5" />
          <div className="text-footnote text-ink-soft space-y-1.5">
            <p>
              <strong className="text-ink">Este documento cobre apenas os lucros distribuídos</strong>,
              que na sua declaração entram em &ldquo;Rendimentos Isentos e Não Tributáveis&rdquo;.
            </p>
            {temProLabore && (
              <p>
                Pró-labore, INSS e imposto retido <strong className="text-ink">não estão aqui</strong> e
                precisam vir da folha de pagamento. Some os dois antes de declarar.
              </p>
            )}
            <p>
              Os valores vêm dos lançamentos registrados no sistema e conferem com a contabilidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
