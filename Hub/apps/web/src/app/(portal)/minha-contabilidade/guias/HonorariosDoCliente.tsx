import { ExternalLink, Receipt } from 'lucide-react';
import type { AsaasPayment } from '@/lib/asaas';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

const SITUACAO: Record<string, { texto: string; cls: string }> = {
  PENDING: { texto: 'A pagar', cls: 'bg-amber-500/10 text-amber-700' },
  OVERDUE: { texto: 'Vencida', cls: 'bg-red-500/10 text-red-700' },
  RECEIVED: { texto: 'Paga', cls: 'bg-emerald-500/10 text-emerald-700' },
  CONFIRMED: { texto: 'Paga', cls: 'bg-emerald-500/10 text-emerald-700' },
  RECEIVED_IN_CASH: { texto: 'Paga', cls: 'bg-emerald-500/10 text-emerald-700' },
};

/**
 * Os honorários da contabilidade, com o boleto e o Pix de cada cobrança.
 * Vêm do Asaas ao vivo: gerada a cobrança lá, ela aparece aqui.
 */
export function HonorariosDoCliente({ cobrancas, semCobranca }: { cobrancas: AsaasPayment[]; semCobranca: boolean }) {
  if (semCobranca || cobrancas.length === 0) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white/80 p-10 text-center text-sm text-[#6E6A61] dark:border-white/10 dark:bg-white/5">
        {semCobranca
          ? 'A cobrança dos honorários ainda não foi vinculada. Assim que a contabilidade gerar, o boleto aparece aqui.'
          : 'Nenhuma cobrança de honorários ainda.'}
      </div>
    );
  }
  const ordenadas = [...cobrancas].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  return (
    <div className="space-y-3">
      {ordenadas.map((c) => {
        const s = SITUACAO[c.status] ?? { texto: c.status, cls: 'bg-black/5 text-[#6E6A61]' };
        const pago = s.texto === 'Paga';
        return (
          <article key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <Receipt className="h-5 w-5 shrink-0 text-[#6E6A61]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Honorários · {BRL.format(c.value)}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Vence em {data(c.dueDate)}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>{s.texto}</span>
            {!pago && (c.bankSlipUrl || c.invoiceUrl) && (
              <div className="flex gap-2">
                {c.bankSlipUrl && (
                  <a href={c.bankSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE]">
                    <ExternalLink className="h-3.5 w-3.5" /> Boleto
                  </a>
                )}
                {c.invoiceUrl && (
                  <a href={c.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold dark:border-white/10">
                    <ExternalLink className="h-3.5 w-3.5" /> Pix e fatura
                  </a>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
