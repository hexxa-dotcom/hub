import { AlertTriangle, Wallet } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { getCaixaLivre } from '@/lib/server/caixa-livre';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * "Quanto desse dinheiro é meu."
 *
 * O número que quem tem PJ sozinho procura e não encontra em lugar nenhum: o
 * saldo do banco menos o que já está comprometido — imposto, fornecedor,
 * pró-labore. Ver `calcularCaixaLivre` para a conta e o porquê de cada
 * parcela.
 *
 * A abertura fica visível junto com o total, de propósito. Um número grande
 * sozinho pede confiança; com as parcelas ao lado, ele se explica — e é
 * conferível por quem entende do próprio negócio.
 */
export async function CaixaLivreCard() {
  let dados;
  try {
    dados = await getCaixaLivre(await getTenantContext());
  } catch (err) {
    console.error('[CaixaLivreCard] falhou:', err);
    return null;
  }

  const { livre, saldoEmConta, impostos, contasAPagar, pessoal, lucrosAPagar, aClassificar } = dados;
  const negativo = livre < 0;

  /**
   * Sem extrato, não há número — há um convite.
   *
   * A empresa que acabou de entrar tem folha e imposto provisionados e nenhum
   * movimento bancário. A conta daria dezenas de milhares negativos, e o
   * cliente leria "estou quebrado" onde o certo é "ainda não te contei meu
   * saldo". Mostrar o vazio é honesto; mostrar o número seria mentir.
   */
  if (!dados.saldoConhecido) {
    return (
      <section data-card="true" className="rounded-3xl border border-black/5 bg-surface-card p-5 dark:border-white/10 sm:p-6 shadow-(--elev-1)">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1E3328] text-[#DFFFAE]">
            <Wallet className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
            Livre para retirar
          </h2>
        </div>
        <p className="mt-3 text-sm text-[#231F20] dark:text-[#F5F6F4]">
          Para dizer quanto do dinheiro é seu, preciso primeiro saber quanto há em conta.
        </p>
        <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Suba um extrato em Conciliação e este número aparece — já com imposto, contas a pagar e
          pró-labore descontados.
        </p>
      </section>
    );
  }

  const linhas: { rotulo: string; valor: number }[] = [
    { rotulo: 'Saldo em conta', valor: saldoEmConta },
    { rotulo: dados.impostoDoMesEstimado ? 'Impostos (inclui o mês, estimado)' : 'Impostos a recolher', valor: -impostos },
    { rotulo: 'Contas a pagar', valor: -contasAPagar },
    { rotulo: 'Pró-labore e encargos', valor: -pessoal },
  ].filter((l) => l.valor !== 0);

  return (
    <section data-card="true" className="rounded-3xl border border-black/5 bg-surface-card p-5 dark:border-white/10 sm:p-6 shadow-(--elev-1)">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1E3328] text-[#DFFFAE]">
          <Wallet className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">
          Livre para retirar
        </h2>
      </div>

      <p
        className={`mt-2 font-serif text-3xl font-bold tabular sm:text-4xl ${
          negativo ? 'text-red-700 dark:text-red-400' : 'text-[#2F4A3C] dark:text-[#DFFFAE]'
        }`}
      >
        {BRL.format(livre)}
      </p>
      <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        {negativo
          ? 'A empresa deve mais do que tem em caixa. Nada a retirar este mês.'
          : 'O que sobra depois de tudo que já está comprometido.'}
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-3 dark:border-white/10">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-3 text-xs sm:text-sm">
            <dt className="text-[#6E6A61] dark:text-[#A8A49C]">{l.rotulo}</dt>
            <dd className="tabular font-medium text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(l.valor)}</dd>
          </div>
        ))}
      </dl>

      {lucrosAPagar > 0 && (
        <p className="mt-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Além disso, {BRL.format(lucrosAPagar)} de lucros já declarados esperam saque — esse dinheiro
          já é seu e não foi descontado acima.
        </p>
      )}

      {aClassificar !== 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {BRL.format(Math.abs(aClassificar))} de movimento bancário ainda sem classificação. Enquanto
          isso não for resolvido, pode haver despesa escondida e este número é provisório.
        </p>
      )}
    </section>
  );
}
