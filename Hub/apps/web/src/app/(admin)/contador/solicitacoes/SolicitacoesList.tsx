'use client';

import { useState } from 'react';
import { ChatTeardropText, CheckCircle, Clock, WarningCircle, CaretDown, CaretUp, PaperPlaneRight, Spinner } from '@phosphor-icons/react';
import { replyToTicketAction, resolveTicketAction } from './actions';

type Prioridade = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type StatusReq = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'RESOLVED' | 'CLOSED';

export type Solicitacao = {
  id: string;
  cliente: string;
  titulo: string;
  prioridade: Prioridade;
  status: StatusReq;
  criada: string;
  respostas: { autor: string; msg: string; quando: string }[];
};

const P_CLS: Record<Prioridade, string> = {
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};
const P_LABEL: Record<Prioridade, string> = { URGENT: '⚡ Urgente', HIGH: '⚡ Alta', MEDIUM: '○ Média', LOW: '· Baixa' };

const S_CFG: Record<StatusReq, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  OPEN: { label: 'Aberta', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: WarningCircle },
  IN_PROGRESS: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  WAITING_CLIENT: { label: 'Aguardando cliente', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  RESOLVED: { label: 'Resolvida', cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  CLOSED: { label: 'Fechada', cls: 'bg-slate-100 text-slate-500', icon: CheckCircle },
};

export function SolicitacoesList({ initial }: { initial: Solicitacao[] }) {
  const [items, setItems] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusReq | 'todas'>('todas');

  const filtered = items.filter(i => filterStatus === 'todas' || i.status === filterStatus);

  async function sendReply(id: string) {
    const msg = reply[id]?.trim();
    if (!msg) return;
    setBusy(id);
    const res = await replyToTicketAction(id, msg);
    if (!('error' in res)) {
      setItems(prev => prev.map(i => i.id === id ? {
        ...i, status: 'IN_PROGRESS' as StatusReq,
        respostas: [...i.respostas, { autor: 'Admin', msg, quando: new Date().toLocaleString('pt-BR') }],
      } : i));
      setReply(r => ({ ...r, [id]: '' }));
    }
    setBusy(null);
  }

  async function resolver(id: string) {
    setBusy(id);
    const res = await resolveTicketAction(id);
    if (!('error' in res)) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'RESOLVED' as StatusReq } : i));
    }
    setBusy(null);
  }

  const abertas = items.filter(i => i.status === 'OPEN').length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Solicitações</h1>
        <p className="text-sm text-slate-500">{abertas} abertas · {items.length} total</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['todas', 'Todas'], ['OPEN', 'Abertas'], ['IN_PROGRESS', 'Em andamento'], ['RESOLVED', 'Resolvidas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilterStatus(k)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              filterStatus === k ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
            }`}>
            {l} ({k === 'todas' ? items.length : items.filter(i => i.status === k).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(s => {
          const stCfg = S_CFG[s.status];
          const StIcon = stCfg.icon;
          const isExp = expanded === s.id;

          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => setExpanded(isExp ? null : s.id)}
                className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${P_CLS[s.prioridade]}`}>{P_LABEL[s.prioridade]}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stCfg.cls}`}>
                      <StIcon className="h-3 w-3" /> {stCfg.label}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{s.titulo}</p>
                  <p className="text-xs text-slate-500">{s.cliente} · {s.criada.split('-').reverse().join('/')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.respostas.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <ChatTeardropText className="h-3.5 w-3.5" /> {s.respostas.length}
                    </span>
                  )}
                  {isExp ? <CaretUp className="h-4 w-4 text-slate-400" /> : <CaretDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {isExp && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-3 space-y-4 dark:border-slate-800">
                  {s.respostas.length > 0 && (
                    <div className="space-y-2">
                      {s.respostas.map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 ${r.autor === 'Admin' ? 'bg-brand-500/10 ml-4' : 'bg-slate-100 mr-4 dark:bg-slate-800'}`}>
                          <p className="text-[10px] font-semibold text-slate-500">{r.autor} · {r.quando}</p>
                          <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{r.msg}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.status !== 'RESOLVED' && s.status !== 'CLOSED' && (
                    <div className="space-y-2">
                      <textarea
                        value={reply[s.id] ?? ''}
                        onChange={e => setReply(r => ({ ...r, [s.id]: e.target.value }))}
                        rows={2}
                        placeholder="Digite sua resposta para o cliente…"
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <div className="flex gap-2">
                        <button disabled={busy === s.id} onClick={() => sendReply(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                          {busy === s.id ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <PaperPlaneRight className="h-3.5 w-3.5" />} Responder
                        </button>
                        <button disabled={busy === s.id} onClick={() => resolver(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-slate-700 dark:text-green-400 transition-colors">
                          <CheckCircle className="h-3.5 w-3.5" /> Marcar resolvida
                        </button>
                      </div>
                    </div>
                  )}
                  {(s.status === 'RESOLVED' || s.status === 'CLOSED') && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Solicitação {s.status === 'RESOLVED' ? 'resolvida' : 'fechada'}.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">Nenhuma solicitação encontrada.</div>
        )}
      </div>
    </div>
  );
}
