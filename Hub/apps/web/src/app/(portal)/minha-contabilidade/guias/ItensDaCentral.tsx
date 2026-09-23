'use client';

import { useState } from 'react';
import { FileText, Receipt, Eye, Download, CheckCircle2, Clock, AlertTriangle, ExternalLink, Calendar } from 'lucide-react';
import type { Entrega } from '@/lib/server/entregas';
import type { AsaasPayment } from '@/lib/asaas';
import { confirmarRecebimentoAction } from './entregas-actions';

/**
 * As linhas que não são guia de imposto — documento do contador e cobrança
 * de honorários —, desenhadas na mesma grade da linha de guia para a lista
 * ler como uma coisa só: selo | título | valor e data | situação | ações.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export const SELO = {
  DOCUMENTO: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20',
  HONORARIOS: 'bg-hexxa-forest/10 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime border border-hexxa-forest/20',
};

const HONORARIO_PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

export function situacaoDoHonorario(status: string): 'OPEN' | 'PAID' | 'OVERDUE' {
  if (HONORARIO_PAGO.has(status)) return 'PAID';
  return status === 'OVERDUE' ? 'OVERDUE' : 'OPEN';
}

const SITUACAO = {
  OPEN: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20', icon: Clock },
  PAID: { label: 'Paga', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  OVERDUE: { label: 'Em atraso', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20', icon: AlertTriangle },
};

const acao =
  'inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors';

export function LinhaDocumento({ doc }: { doc: Entrega }) {
  const [confirmado, setConfirmado] = useState(Boolean(doc.confirmadoEm));
  const [aviso, setAviso] = useState<string | null>(null);
  const novo = !doc.visualizadoEm;

  return (
    <div className="flex w-full flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${SELO.DOCUMENTO}`}>Documento</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {doc.titulo}
          {novo && <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Novo</span>}
        </p>
        <p className="truncate text-xs text-ink-soft">
          Protocolo {doc.protocolo}
          {doc.descricao ? ` · ${doc.descricao}` : ''}
          {aviso ? ` · ${aviso}` : ''}
        </p>
      </div>
      <div className="w-28 shrink-0 text-right">
        <p className="text-[11px] text-ink-soft sm:text-xs">
          <Calendar className="mr-1 inline h-3 w-3" />
          Recebido {dia(doc.enviadoEm)}
        </p>
      </div>
      <span className="hidden w-28 shrink-0 justify-center sm:inline-flex">
        {confirmado ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${SITUACAO.PAID.cls}`}>
            <CheckCircle2 className="h-3 w-3" /> Confirmado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-xs font-bold text-ink-soft dark:border-white/10">
            <FileText className="h-3 w-3" /> {novo ? 'Não aberto' : 'Aberto'}
          </span>
        )}
      </span>
      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:w-52">
        {doc.temArquivo && (
          <>
            <a href={`/api/documentos/${doc.id}`} target="_blank" rel="noreferrer" className={acao}>
              <Eye className="h-3.5 w-3.5" /> Abrir
            </a>
            <a href={`/api/documentos/${doc.id}?modo=baixar`} title="Baixar" className={`${acao} px-2`}>
              <Download className="h-3.5 w-3.5" />
            </a>
          </>
        )}
        {!confirmado && (
          <button
            type="button"
            onClick={async () => {
              const r = await confirmarRecebimentoAction(doc.id);
              if (r.ok) setConfirmado(true);
              else setAviso(r.message);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Recebi
          </button>
        )}
      </div>
      <span className="hidden w-6 shrink-0 sm:block" />
    </div>
  );
}

export function LinhaHonorario({ hon }: { hon: AsaasPayment }) {
  const s = SITUACAO[situacaoDoHonorario(hon.status)];
  const pago = situacaoDoHonorario(hon.status) === 'PAID';
  return (
    <div className="flex w-full flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${SELO.HONORARIOS}`}>Honorários</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">Honorários da contabilidade</p>
        <p className="text-xs text-ink-soft">Cobrança mensal</p>
      </div>
      <div className="w-28 shrink-0 text-right">
        <p className="text-sm font-serif tabular font-bold text-ink">{BRL.format(hon.value)}</p>
        <p className="text-[11px] text-ink-soft sm:text-xs">
          <Calendar className="mr-1 inline h-3 w-3" />
          {pago ? 'Paga' : `Vence ${dia(hon.dueDate)}`}
        </p>
      </div>
      <span className="hidden w-28 shrink-0 justify-center sm:inline-flex">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
          <s.icon className="h-3 w-3" /> {s.label}
        </span>
      </span>
      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:w-52">
        {!pago && hon.bankSlipUrl && (
          <a href={hon.bankSlipUrl} target="_blank" rel="noreferrer" className={acao}>
            <Receipt className="h-3.5 w-3.5" /> Boleto
          </a>
        )}
        {!pago && hon.invoiceUrl && (
          <a href={hon.invoiceUrl} target="_blank" rel="noreferrer" className={acao}>
            <ExternalLink className="h-3.5 w-3.5" /> Pix
          </a>
        )}
      </div>
      <span className="hidden w-6 shrink-0 sm:block" />
    </div>
  );
}
