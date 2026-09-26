'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { createTarefaAction, updateTarefaStatusAction, deleteTarefaAction, type TarefaRow, type TarefaStatus, type TarefaPrioridade } from './actions';

/** Tarefas do relacionamento: o que fazer com cada cliente, com prazo e prioridade. */

export type ClienteDaTarefa = { id: string; nome: string };
type Filtro = 'ABERTAS' | 'ATRASADAS' | 'CONCLUIDAS';

const STATUS: Record<TarefaStatus, string> = { pendente: 'A fazer', em_andamento: 'Fazendo', concluida: 'Feita' };
const PRIORIDADE: Record<TarefaPrioridade, { texto: string; cor: string }> = {
  baixa: { texto: 'Baixa', cor: 'text-ink-soft' },
  normal: { texto: 'Normal', cor: 'text-ink-soft' },
  alta: { texto: 'Alta', cor: 'text-amber-700 dark:text-amber-400' },
  urgente: { texto: 'Urgente', cor: 'text-rose-600 dark:text-rose-400' },
};
const campo =
  'mt-1.5 w-full rounded-2xl border border-black/5 bg-surface-card px-4 py-2.5 text-sm text-ink shadow-(--elev-inset) outline-none focus:ring-2 focus:ring-hexxa-green dark:border-white/5 dark:focus:ring-hexxa-lime';
const botao =
  'inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest';

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const atrasada = (t: TarefaRow) => t.status !== 'concluida' && !!t.prazo && t.prazo < hojeSP();

function prazoTexto(prazo: string | null) {
  if (!prazo) return 'sem prazo';
  const hoje = hojeSP();
  const dias = Math.round((Date.parse(`${prazo}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000);
  if (dias < 0) return `atrasada ${-dias} ${dias === -1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `até ${prazo.split('-').reverse().join('/')}`;
}

export function TarefasTab({ clientes, tarefas, onChanged }: { clientes: ClienteDaTarefa[]; tarefas: TarefaRow[]; onChanged: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('ABERTAS');
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const abertas = tarefas.filter((t) => t.status !== 'concluida');
  const atrasadas = tarefas.filter(atrasada);
  const feitas = tarefas.filter((t) => t.status === 'concluida');
  const lista = (filtro === 'ABERTAS' ? abertas : filtro === 'ATRASADAS' ? atrasadas : feitas).sort((a, b) =>
    (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'),
  );

  async function mudar(id: string, status: TarefaStatus) {
    await updateTarefaStatusAction(id, status);
    onChanged();
  }
  async function remover(id: string) {
    await deleteTarefaAction(id);
    setAberta(null);
    setConfirmar(null);
    onChanged();
  }

  return (
    <div className="space-y-10">
      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Em aberto" valor={abertas.length} nota={`${abertas.filter((t) => t.status === 'em_andamento').length} em andamento`} onClick={() => setFiltro('ABERTAS')} />
        <CardResumo rotulo="Atrasadas" valor={atrasadas.length} nota="Passaram do prazo" tom={atrasadas.length ? 'alerta' : 'padrao'} onClick={() => setFiltro('ATRASADAS')} />
        <CardResumo rotulo="Feitas" valor={feitas.length} nota="Concluídas" onClick={() => setFiltro('CONCLUIDAS')} />
      </GradeDeResumo>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FiltrosEmTexto<Filtro>
            ativo={filtro}
            onChange={setFiltro}
            filtros={[
              { id: 'ABERTAS', label: 'Em aberto', count: abertas.length },
              { id: 'ATRASADAS', label: 'Atrasadas', count: atrasadas.length, badge: atrasadas.length || undefined },
              { id: 'CONCLUIDAS', label: 'Feitas', count: feitas.length },
            ]}
          />
          <button type="button" onClick={() => setNova(true)} className={botao}>
            <Plus className="h-3.5 w-3.5" /> Nova tarefa
          </button>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            {tarefas.length === 0 ? 'Nenhuma tarefa. Anote aqui o que fazer com cada cliente: ligar, mandar proposta, cobrar.' : 'Nenhuma tarefa neste filtro.'}
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/[0.12] dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
            {lista.map((t) => {
              const p = PRIORIDADE[t.prioridade];
              const feita = t.status === 'concluida';
              const aberto = aberta === t.id;
              return (
                <li key={t.id}>
                  <div className="flex items-start gap-4 px-6 py-4">
                    <button
                      type="button"
                      onClick={() => mudar(t.id, feita ? 'pendente' : 'concluida')}
                      aria-label={feita ? 'Reabrir tarefa' : 'Marcar como feita'}
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${feita ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-black/25 hover:border-ink dark:border-white/30'}`}
                    >
                      {feita && <span className="text-[11px] leading-none">✓</span>}
                    </button>
                    <button type="button" onClick={() => setAberta(aberto ? null : t.id)} className="min-w-0 flex-1 text-left">
                      <p className={`truncate text-sm font-semibold ${feita ? 'text-ink-soft line-through' : 'text-ink'}`}>{t.titulo}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {t.clienteNome ?? 'Sem cliente'} · <span className={atrasada(t) ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>{prazoTexto(t.prazo)}</span>
                        {t.prioridade !== 'normal' && <span className={`font-semibold ${p.cor}`}> · {p.texto}</span>}
                        {t.status === 'em_andamento' && ' · fazendo'}
                      </p>
                    </button>
                  </div>
                  {aberto && (
                    <div className="space-y-3 border-t border-black/5 bg-black/[0.015] px-6 py-4 pl-15 dark:border-white/10 dark:bg-white/[0.02]">
                      {t.descricao && <p className="whitespace-pre-wrap text-sm text-ink-soft">{t.descricao}</p>}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
                        {(['pendente', 'em_andamento', 'concluida'] as TarefaStatus[]).map((s) => (
                          <button key={s} type="button" onClick={() => mudar(t.id, s)} className={t.status === s ? 'text-ink underline underline-offset-4' : 'text-ink-soft hover:text-ink'}>
                            {STATUS[s]}
                          </button>
                        ))}
                        {confirmar === t.id ? (
                          <span className="flex items-center gap-3">
                            <span className="font-normal text-ink-soft">Excluir?</span>
                            <button type="button" onClick={() => remover(t.id)} className="text-rose-600 dark:text-rose-400">Sim</button>
                            <button type="button" onClick={() => setConfirmar(null)} className="text-ink-soft hover:text-ink">Não</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmar(t.id)} className="text-ink-soft hover:text-rose-600">Excluir</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {nova && <NovaTarefa clientes={clientes} onClose={() => setNova(false)} onDone={onChanged} />}
    </div>
  );
}

function NovaTarefa({ clientes, onClose, onDone }: { clientes: ClienteDaTarefa[]; onClose: () => void; onDone: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('normal');
  const [prazo, setPrazo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await createTarefaAction({ titulo, descricao: descricao.trim() || null, customerId: clienteId || null, prioridade, prazo: prazo || null });
      if (!r.ok) return setErro(r.message);
      onDone();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">Nova tarefa</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{titulo || 'Tarefa'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">O que fazer</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para renovar o contrato" className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">Cliente</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={campo}>
              <option value="">Nenhum</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Prazo</span>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={campo} />
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Prioridade</span>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as TarefaPrioridade)} className={campo}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">Anotações</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={campo} />
          </label>
        </div>
        {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
        <button type="button" onClick={salvar} disabled={salvando} className={`${botao} mt-5 w-full py-3 text-sm`}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar tarefa
        </button>
      </div>
    </div>
  );
}
