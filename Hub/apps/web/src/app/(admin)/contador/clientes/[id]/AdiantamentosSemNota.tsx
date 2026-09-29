import type { AdiantamentoDoCliente } from '@hexxa/db';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DIAS_PARA_AGIR = 90;

/**
 * Recebido sem nota, parado em Adiantamento de Clientes, por cliente.
 * Passou de 90 dias: emitir a nota agora (competência atual), devolver, ou
 * baixar no encerramento do exercício — decisão do contador.
 */
export function AdiantamentosSemNota({ itens }: { itens: AdiantamentoDoCliente[] }) {
  if (!itens.length) return null;
  const total = itens.reduce((s, i) => s + i.saldo, 0);
  const antigos = itens.filter((i) => i.dias >= DIAS_PARA_AGIR);
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121614]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-base font-bold text-[#231F20] dark:text-[#F5F6F4]">Recebido sem nota (adiantamento de clientes)</h2>
        <span className="text-sm font-semibold tabular-nums text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(total)}</span>
      </div>
      <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Entrou no banco sem nota. Quando a nota do cliente sai, o Hub compensa sozinho.
        {antigos.length > 0 && ` ${antigos.length} parado(s) há mais de ${DIAS_PARA_AGIR} dias: emitir a nota agora, devolver, ou baixar no encerramento do ano.`}
      </p>
      <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
        {itens.map((i) => (
          <li key={i.cnpj} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-[#231F20] dark:text-[#F5F6F4]">{i.nome}</span>
              <span className="block text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                {i.cnpj === 'SEM_CNPJ' ? 'sem CNPJ no extrato' : i.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} · desde {i.desde.split('-').reverse().join('/')}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {i.dias >= DIAS_PARA_AGIR && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">{i.dias} dias</span>
              )}
              <span className="tabular-nums font-semibold text-[#231F20] dark:text-[#F5F6F4]">{BRL.format(i.saldo)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
