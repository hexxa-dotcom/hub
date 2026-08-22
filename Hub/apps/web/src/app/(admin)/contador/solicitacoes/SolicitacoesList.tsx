'use client';

import { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
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
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200',
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200',
  LOW: 'bg-black/5 text-[#6E6A61] dark:bg-white/5 dark:text-[#A8A49C]',
};
const P_LABEL: Record<Prioridade, string> = { URGENT: '⚡ Urgente', HIGH: '⚡ Alta', MEDIUM: '○ Média', LOW: '· Baixa' };

const S_CFG: Record<StatusReq, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  OPEN: { label: 'Aberta', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200', icon: AlertTriangle },
  IN_PROGRESS: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200', icon: Clock },
  WAITING_CLIENT: { label: 'Aguardando cliente', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200', icon: Clock },
  RESOLVED: { label: 'Resolvida', cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#1E3328] dark:text-[#DFFFAE] border border-[#DFFFAE]', icon: CheckCircle2 },
  CLOSED: { label: 'Fechada', cls: 'bg-black/5 text-[#6E6A61]', icon: CheckCircle2 },
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
    <div className="w-full space-y-7 animate-fade-up">
      {/* Header */}
      <div className="rounded-3xl bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/5 dark:border-white/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] text-[#DFFFAE] px-3.5 py-1 text-xs font-bold shadow-sm mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Central de Atendimento
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              Solicitações dos Clientes
            </h1>
            <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              {abertas} chamados em aberto aguardando resposta · {items.length} solicitações no total
            </p>
          </div>
        </div>
      </div>

      {/* Filtros em Pílula */}
      <div className="flex flex-wrap gap-2">
        {([['todas', 'Todas'], ['OPEN', 'Abertas'], ['IN_PROGRESS', 'Em andamento'], ['RESOLVED', 'Resolvidas']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(k)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
              filterStatus === k
                ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                : 'border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
            }`}
          >
            {l} ({k === 'todas' ? items.length : items.filter(i => i.status === k).length})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(s => {
          const stCfg = S_CFG[s.status];
          const StIcon = stCfg.icon;
          const isExp = expanded === s.id;

          return (
            <div key={s.id} className="overflow-hidden rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] shadow-sm">
              <button
                type="button"
                onClick={() => setExpanded(isExp ? null : s.id)}
                className="flex w-full items-start gap-4 p-5 sm:p-6 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${P_CLS[s.prioridade]}`}>
                      {P_LABEL[s.prioridade]}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${stCfg.cls}`}>
                      <StIcon className="h-3 w-3" /> {stCfg.label}
                    </span>
                  </div>
                  <p className="font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">{s.titulo}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{s.cliente} · Aberta em {s.criada.split('-').reverse().join('/')}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.respostas.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#6E6A61] dark:text-[#A8A49C]">
                      <MessageSquare className="h-3.5 w-3.5" /> {s.respostas.length}
                    </span>
                  )}
                  {isExp ? <ChevronUp className="h-5 w-5 text-[#6E6A61]" /> : <ChevronDown className="h-5 w-5 text-[#6E6A61]" />}
                </div>
              </button>

              {isExp && (
                <div className="border-t border-black/5 dark:border-white/10 p-5 sm:p-6 space-y-5 bg-white/50 dark:bg-black/20">
                  {s.respostas.length > 0 && (
                    <div className="space-y-2.5">
                      {s.respostas.map((r, i) => (
                        <div
                          key={i}
                          className={`rounded-2xl p-4 ${
                            r.autor === 'Admin'
                              ? 'bg-[#1E3328] text-[#FEFDF3] ml-4 sm:ml-8 border border-[#2F4A3C]'
                              : 'bg-[#F4EFE4] dark:bg-[#1A201C] mr-4 sm:mr-8 border border-black/5 text-[#231F20] dark:text-[#FEFDF3]'
                          }`}
                        >
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${r.autor === 'Admin' ? 'text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
                            {r.autor} · {r.quando}
                          </p>
                          <p className="mt-1 text-sm">{r.msg}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.status !== 'RESOLVED' && s.status !== 'CLOSED' && (
                    <div className="space-y-3 pt-2">
                      <textarea
                        value={reply[s.id] ?? ''}
                        onChange={e => setReply(r => ({ ...r, [s.id]: e.target.value }))}
                        rows={3}
                        placeholder="Digite sua resposta técnica ou orientação para o cliente…"
                        className="w-full resize-none rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] p-4 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
                      />
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          disabled={busy === s.id}
                          onClick={() => sendReply(s.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar Resposta
                        </button>
                        <button
                          disabled={busy === s.id}
                          onClick={() => resolver(s.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#EFFFD6] hover:bg-[#DFFFAE] px-5 py-2.5 text-xs font-bold text-[#2F4A3C] border border-[#DFFFAE] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Resolvida
                        </button>
                      </div>
                    </div>
                  )}

                  {(s.status === 'RESOLVED' || s.status === 'CLOSED') && (
                    <p className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Solicitação {s.status === 'RESOLVED' ? 'resolvida' : 'fechada com sucesso'}.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
            Nenhuma solicitação encontrada no filtro selecionado.
          </div>
        )}
      </div>
    </div>
  );
}
