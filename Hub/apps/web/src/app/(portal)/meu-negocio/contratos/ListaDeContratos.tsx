'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Plus, PenLine } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import type { ContractRow } from './actions';
import { INDICES } from './modelos-info';

/**
 * OS CONTRATOS DE ENTRADA OU DE SAÍDA.
 *
 * Em cima, o que pede ação: os contratos esperando a sua assinatura. Depois,
 * o resumo do mês (quanto está contratado), e a lista — cada linha diz em
 * uma frase em que pé o contrato está: esperando quem, até quando vale, quando
 * reajusta.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const br = (iso: string) => iso.split('-').reverse().join('/');
const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoje()}T12:00:00Z`)) / 86400000);

type Filtro = 'ativos' | 'aguardando' | 'encerrados';

/** Em que pé o contrato está, numa frase — e se pede atenção. */
export function situacao(c: ContractRow): { texto: string; tom: 'normal' | 'atencao' | 'alerta' | 'apagado' } {
  if (c.status === 'AGUARDANDO_ASSINATURA') {
    if (c.meFaltaAssinar) return { texto: c.initiatedHere ? 'Falta a sua assinatura' : `${c.partyName} enviou para você assinar`, tom: 'alerta' };
    return { texto: `Aguardando a assinatura de ${c.partyName}`, tom: 'atencao' };
  }
  if (c.status === 'RECUSADO') return { texto: `Recusado${c.refusalReason ? `: ${c.refusalReason}` : ''}`, tom: 'alerta' };
  if (c.status === 'CANCELADO') return { texto: 'Cancelado', tom: 'apagado' };
  if (c.status === 'EXPIRADO') return { texto: 'Assinatura expirou', tom: 'apagado' };
  const fim = diasAte(c.endDate);
  if (fim < 0) return { texto: `Terminou em ${br(c.endDate)}`, tom: 'apagado' };
  if (fim <= 30) return { texto: `Termina em ${fim} ${fim === 1 ? 'dia' : 'dias'} · ${br(c.endDate)}`, tom: 'atencao' };
  if (c.nextAdjustmentDate && c.adjustmentIndex !== 'NENHUM') {
    const r = diasAte(c.nextAdjustmentDate);
    if (r <= 30) return { texto: r <= 0 ? `Reajuste pelo ${c.adjustmentIndex} disponível` : `Reajuste pelo ${c.adjustmentIndex} em ${r} dias`, tom: 'atencao' };
  }
  return { texto: `Ativo até ${br(c.endDate)}`, tom: 'normal' };
}

const COR = {
  normal: 'text-ink-soft',
  atencao: 'text-amber-700 dark:text-amber-400',
  alerta: 'text-rose-600 dark:text-rose-400',
  apagado: 'text-ink-soft/70',
};

export function ListaDeContratos({
  tipo,
  contratos,
  onNovo,
  onAssinar,
}: {
  tipo: 'ENTRADA' | 'SAIDA';
  contratos: ContractRow[];
  onNovo: () => void;
  onAssinar: (c: ContractRow) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const ativos = contratos.filter((c) => c.status === 'ATIVO' && c.endDate >= hoje());
  const aguardando = contratos.filter((c) => c.status === 'AGUARDANDO_ASSINATURA');
  const encerrados = contratos.filter((c) => !ativos.includes(c) && !aguardando.includes(c));
  const minhaAssinatura = aguardando.filter((c) => c.meFaltaAssinar);

  const porMes = ativos.reduce((s, c) => s + c.value, 0);
  const emBreve = ativos.filter(
    (c) => diasAte(c.endDate) <= 60 || (c.adjustmentIndex !== 'NENHUM' && c.nextAdjustmentDate && diasAte(c.nextAdjustmentDate) <= 60),
  );
  const lista = useMemo(
    () => (filtro === 'ativos' ? ativos : filtro === 'aguardando' ? aguardando : encerrados),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtro, contratos],
  );

  return (
    <div className="space-y-12">
      {/* O que pede ação: assinar. */}
      {minhaAssinatura.length > 0 && (
        <section className="rounded-[28px] border border-rose-500/20 bg-rose-500/[0.04] p-6 sm:p-7">
          <p className="rotulo text-rose-700 dark:text-rose-400">Aguardando sua assinatura</p>
          <ul className="mt-4 divide-y divide-rose-500/10">
            {minhaAssinatura.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                  <p className="text-xs text-ink-soft">
                    {c.partyName} · {BRL.format(c.value)}/mês{c.outraAssinou ? ' · a outra parte já assinou' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAssinar(c)}
                  className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime dark:bg-hexxa-lime dark:text-hexxa-forest"
                >
                  <PenLine className="h-3.5 w-3.5" /> Ler e assinar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GradeDeResumo colunas={3}>
        <CardResumo
          destaque
          rotulo={tipo === 'ENTRADA' ? 'Contratado para receber' : 'Contratado para pagar'}
          valor={`${BRL.format(porMes)}`}
          nota={`por mês · ${ativos.length} ${ativos.length === 1 ? 'contrato ativo' : 'contratos ativos'}`}
        />
        <CardResumo
          rotulo="Aguardando assinatura"
          valor={aguardando.length}
          tom={minhaAssinatura.length ? 'negativo' : 'padrao'}
          nota={minhaAssinatura.length ? `${minhaAssinatura.length} com você` : 'As parcelas entram quando os dois assinarem'}
          onClick={() => setFiltro('aguardando')}
        />
        <CardResumo
          rotulo="Nos próximos 60 dias"
          valor={emBreve.length}
          tom={emBreve.length ? 'alerta' : 'padrao'}
          nota={emBreve.length ? 'Contratos que terminam ou reajustam' : 'Nenhum término nem reajuste'}
          onClick={() => setFiltro('ativos')}
        />
      </GradeDeResumo>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FiltrosEmTexto<Filtro>
            ativo={filtro}
            onChange={setFiltro}
            filtros={[
              { id: 'ativos', label: 'Ativos', count: ativos.length },
              { id: 'aguardando', label: 'Aguardando assinatura', count: aguardando.length, badge: minhaAssinatura.length || undefined },
              { id: 'encerrados', label: 'Encerrados', count: encerrados.length },
            ]}
          />
          <button
            type="button"
            onClick={onNovo}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Novo contrato
          </button>
        </div>

        {lista.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-black/10 px-6 py-14 text-center dark:border-white/10">
            <p className="text-sm text-ink-soft">
              {filtro === 'ativos'
                ? tipo === 'ENTRADA'
                  ? 'Nenhum contrato com cliente ainda.'
                  : 'Nenhum contrato com quem presta serviço para você ainda.'
                : filtro === 'aguardando'
                  ? 'Nada esperando assinatura.'
                  : 'Nenhum contrato encerrado.'}
            </p>
            {filtro === 'ativos' && (
              <button type="button" onClick={onNovo} className="mt-3 text-sm font-semibold text-ink underline-offset-4 hover:underline">
                Criar o primeiro
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {lista.map((c) => {
              const s = situacao(c);
              return (
                <li key={c.id}>
                  <Link
                    href={`/meu-negocio/contratos/${c.id}` as Route}
                    className="flex items-center justify-between gap-6 px-6 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">
                        {c.partyName}
                        {c.linkedOnPlatform ? ' · na Hexx' : ''}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${COR[s.tom]}`}>{s.texto}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-serif text-lg font-bold tabular text-ink">{BRL.format(c.value)}</p>
                      <p className="text-[11px] text-ink-soft">
                        por mês · dia {c.dueDay}
                        {c.adjustmentIndex !== 'NENHUM' && c.status === 'ATIVO' ? ` · ${INDICES[c.adjustmentIndex].split(' ')[0]}` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
