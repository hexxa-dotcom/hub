'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import type { Fatura, PlanoAtual } from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) => iso.split('-').reverse().join('/');
const mes = (iso: string) => {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const STATUS: Record<NonNullable<PlanoAtual>['status'], string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Em período de teste',
  PAST_DUE: 'Com fatura em atraso',
  CANCELED: 'Cancelado',
};
const SITUACAO: Record<Fatura['situacao'], { texto: string; cor: string }> = {
  ABERTA: { texto: 'Em aberto', cor: 'text-ink-soft' },
  ATRASADA: { texto: 'Atrasada', cor: 'text-rose-600 dark:text-rose-400' },
  PAGA: { texto: 'Paga', cor: 'text-emerald-700 dark:text-emerald-400' },
};

export function MeuPlanoClient({ plano, faturas, whatsappUrl }: { plano: PlanoAtual; faturas: Fatura[]; whatsappUrl: string | null }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  if (!plano) {
    return (
      <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
        Nenhum plano ativo ainda. A contabilidade ativa o plano quando o cadastro é aprovado.
      </p>
    );
  }

  const emAberto = faturas.filter((f) => f.situacao !== 'PAGA');
  const atrasadas = faturas.filter((f) => f.situacao === 'ATRASADA');
  const proxima = [...emAberto].sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

  async function copiar(f: Fatura) {
    if (!f.pix) return;
    await navigator.clipboard.writeText(f.pix).catch(() => {});
    setCopiado(f.id);
    setTimeout(() => setCopiado(null), 2000);
  }

  const falar = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">
      fale com a contabilidade
    </a>
  ) : (
    <Link href="/suporte" className="font-semibold text-ink underline-offset-4 hover:underline">
      fale com a contabilidade
    </Link>
  );

  return (
    <div className="space-y-10">
      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo={`Plano ${plano.nome}`} valor={`${BRL.format(plano.valor)}/mês`} nota={plano.comoChegou ?? STATUS[plano.status]} />
        <CardResumo
          rotulo="Próxima fatura"
          valor={proxima ? BRL.format(proxima.valor) : '—'}
          nota={proxima ? `Vence em ${data(proxima.vencimento)}` : 'Nenhuma em aberto'}
          tom={atrasadas.length ? 'alerta' : 'padrao'}
        />
        <CardResumo rotulo="Situação" valor={atrasadas.length ? `${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}` : 'Em dia'} nota={plano.desde ? `Cliente desde ${data(plano.desde)}` : STATUS[plano.status]} />
      </GradeDeResumo>

      <section className="space-y-5">
        <p className="rotulo text-ink-soft">Faturas de honorários</p>
        {faturas.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            Nenhuma fatura ainda. A fatura do mês é gerada no dia 1º.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {faturas.map((f) => {
              const s = SITUACAO[f.situacao];
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{mes(f.referencia)}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{f.descricao}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    {f.pix && f.situacao !== 'PAGA' && (
                      <button type="button" onClick={() => copiar(f)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                        {copiado === f.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado === f.id ? 'Copiado' : 'Copiar Pix'}
                      </button>
                    )}
                    <div>
                      <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(f.valor)}</p>
                      <p className={`text-[11px] font-semibold ${s.cor}`}>
                        {s.texto} · vence {data(f.vencimento)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-ink-soft">
          A fatura inclui os adicionais do mês (colaborador ou sócio além dos inclusos, admissões e rescisões). Para pagar, pedir o boleto ou tirar
          uma dúvida sobre o valor, {falar}.
        </p>
      </section>

      {plano.recursos.length > 0 && (
        <section className="space-y-4">
          <p className="rotulo text-ink-soft">O que o plano {plano.nome} inclui</p>
          {plano.descricao && <p className="text-sm text-ink-soft">{plano.descricao}</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {plano.recursos.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-hexxa-lime" /> {r}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">
            Serviços fora do plano (certidões, alterações, abertura de filial) ficam em{' '}
            <Link href="/mais/servicos" className="font-semibold text-ink underline-offset-4 hover:underline">
              Serviços Adicionais
            </Link>
            , com o preço de cada um.
          </p>
        </section>
      )}
    </div>
  );
}
