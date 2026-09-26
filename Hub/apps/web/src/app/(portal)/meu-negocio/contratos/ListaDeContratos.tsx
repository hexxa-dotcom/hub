'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Plus, PenLine } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import type { ContractRow } from './actions';
import { INDICES } from './modelos-info';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';

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

/** A situação na coluna: curta. A frase inteira fica no detalhe. */
function rotuloCurto(c: ContractRow, tom: 'normal' | 'atencao' | 'alerta' | 'apagado') {
  if (c.status === 'AGUARDANDO_ASSINATURA') return c.meFaltaAssinar ? 'Falta assinar' : 'Aguardando';
  if (c.status === 'RECUSADO') return 'Recusado';
  if (c.status === 'CANCELADO') return 'Cancelado';
  if (c.status === 'EXPIRADO') return 'Expirado';
  if (tom === 'apagado') return 'Encerrado';
  if (tom === 'atencao') return diasAte(c.endDate) <= 30 ? 'Termina logo' : 'Reajuste';
  return 'Ativo';
}

const COR_DO_PONTO = {
  normal: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  alerta: 'bg-rose-500',
  apagado: 'bg-black/25 dark:bg-white/25',
};

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
                    {nomeDeExibicao(c.partyName)} · {BRL.format(c.value)}/mês{c.outraAssinou ? ' · a outra parte já assinou' : ''}
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
          <ListaEmColunas
            colunas={[
              { rotulo: 'Contrato', largura: 'minmax(0,1fr)' },
              { rotulo: 'Situação', largura: '9rem', soDesktop: true },
              { rotulo: 'Vigência', largura: '6rem', alinhar: 'direita', soDesktop: true },
              { rotulo: 'Por mês', largura: '8rem', alinhar: 'direita' },
            ]}
            itens={lista}
            chave={(c) => c.id}
            apagada={(c) => situacao(c).tom === 'apagado'}
            celulas={(c) => {
              const s = situacao(c);
              const parte = nomeDeExibicao(c.partyName);
              return [
                <Titulo key="t" nome={c.title} monograma={iniciais(parte)} apoio={`${parte}${c.linkedOnPlatform ? ' · na Hexx' : ''}`} />,
                <Situacao key="s" cor={COR_DO_PONTO[s.tom]}>{rotuloCurto(c, s.tom)}</Situacao>,
                <span key="v" className="text-xs tabular text-ink-soft">até {br(c.endDate).slice(0, 6)}{c.endDate.slice(2, 4)}</span>,
                <Valor key="$">{BRL.format(c.value)}</Valor>,
              ];
            }}
            detalhe={(c) => {
              const s = situacao(c);
              return (
                <Detalhe
                  acoes={
                    <>
                      {c.meFaltaAssinar && (
                        <BotaoDiscreto onClick={() => onAssinar(c)}>
                          <PenLine className="h-3.5 w-3.5" /> Ler e assinar
                        </BotaoDiscreto>
                      )}
                      <BotaoDiscreto href={`/meu-negocio/contratos/${c.id}`}>Abrir contrato</BotaoDiscreto>
                    </>
                  }
                >
                  <Campo rotulo="Situação" largo>
                    <span className={COR[s.tom]}>{s.texto}</span>
                  </Campo>
                  <Campo rotulo={tipo === 'ENTRADA' ? 'Cliente' : 'Prestador'} largo>
                    {c.partyName}
                    {c.partyCnpj ? <span className="text-ink-soft"> · {c.partyCnpj}</span> : null}
                  </Campo>
                  <Campo rotulo="Vigência">
                    {br(c.startDate)} a {br(c.endDate)}
                  </Campo>
                  <Campo rotulo="Vencimento">Todo dia {c.dueDay}</Campo>
                  <Campo rotulo="Reajuste">
                    {c.adjustmentIndex === 'NENHUM' ? 'Sem reajuste' : `${INDICES[c.adjustmentIndex].split(' ')[0]}${c.nextAdjustmentDate ? ` · em ${br(c.nextAdjustmentDate)}` : ''}`}
                  </Campo>
                </Detalhe>
              );
            }}
          />
        )}
      </section>
    </div>
  );
}
