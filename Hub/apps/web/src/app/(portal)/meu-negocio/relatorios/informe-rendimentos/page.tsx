import Link from 'next/link';
import { getTenantContext } from '@/lib/server/tenant';
import { getInformeDeRendimentos } from '@/lib/server/informe-rendimentos';
import { SectionHero } from '@/components/ui/SectionHero';
import { PrintButton } from './PrintButton';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';

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
    <div className="mx-auto max-w-3xl space-y-16 pb-10">
      <SectionHero
        subtitulo="Lucros distribuídos aos sócios no ano"
        title={`Informe de rendimentos ${informe.ano}`}
        infoTitle="Sobre o Informe de Rendimentos"
        infoDescription={`Os lucros distribuídos aos sócios em ${informe.ano} — o documento que cada sócio usa na declaração de Imposto de Renda.`}
        className="print:hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        {informe.anosDisponiveis.length > 1 ? (
          <FiltrosEmTexto
            filtros={informe.anosDisponiveis.map((a) => ({ id: String(a), label: String(a), href: `/meu-negocio/relatorios/informe-rendimentos?ano=${a}` }))}
            ativo={String(informe.ano)}
          />
        ) : (
          <span />
        )}
        <PrintButton />
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/75 p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5 print:border-0 print:bg-transparent print:p-0 print:ring-0">
        <header className="border-b border-black/5 pb-5 dark:border-white/10">
          <p className="rotulo text-ink-soft">Fonte pagadora</p>
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
                    <p className="font-serif text-title2 font-bold tabular text-ink">
                      {BRL.format(s.totalDistribuido)}
                    </p>
                  </div>

                  <p className="rotulo text-ink-soft mt-4">
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
        <div className="mt-8 border-t border-black/5 pt-5 dark:border-white/10">
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
              Os valores vêm das distribuições de lucro registradas no sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
