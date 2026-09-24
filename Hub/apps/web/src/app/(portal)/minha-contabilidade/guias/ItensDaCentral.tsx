'use client';

import { useState } from 'react';
import { Receipt, Eye, Download, CheckCircle2, ExternalLink } from 'lucide-react';
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


const HONORARIO_PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

export function situacaoDoHonorario(status: string): 'OPEN' | 'PAID' | 'OVERDUE' {
  if (HONORARIO_PAGO.has(status)) return 'PAID';
  return status === 'OVERDUE' ? 'OVERDUE' : 'OPEN';
}

// A situação aparece pela cor da data, como na linha de guia — sem pílula.
const SITUACAO = {
  OPEN: { texto: 'text-ink-soft' },
  PAID: { texto: 'text-emerald-700 dark:text-emerald-400' },
  OVERDUE: { texto: 'text-rose-600 dark:text-rose-400 font-bold' },
};

const acao =
  'inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1) px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink transition-colors';

export function LinhaDocumento({ doc }: { doc: Entrega }) {
  const [confirmado, setConfirmado] = useState(Boolean(doc.confirmadoEm));
  const [aviso, setAviso] = useState<string | null>(null);
  const novo = !doc.visualizadoEm;

  return (
    <div className="flex w-full flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
      <span className="rotulo w-24 shrink-0 text-ink-soft">Documento</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {doc.titulo}
          {novo && <span className="ml-2 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-amber-500" title="Ainda não aberto" />}
        </p>
        <p className="truncate text-xs text-ink-soft">
          {confirmado ? 'Recebimento confirmado' : novo ? 'Não aberto' : 'Aberto'} · protocolo {doc.protocolo}
          {doc.descricao ? ` · ${doc.descricao}` : ''}
          {aviso ? ` · ${aviso}` : ''}
        </p>
      </div>
      <p className="hidden w-36 shrink-0 text-right text-xs text-ink-soft sm:block">Recebido em {dia(doc.enviadoEm)}</p>
      <p className="w-28 shrink-0 text-right text-sm font-serif tabular font-bold text-ink">
        {doc.valor != null ? BRL.format(doc.valor) : ''}
      </p>
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
      <span className="rotulo w-24 shrink-0 text-ink-soft">Honorários</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">Honorários da contabilidade</p>
        <p className="text-xs text-ink-soft">Cobrança mensal</p>
      </div>
      <p className={`hidden w-36 shrink-0 text-right text-xs sm:block ${s.texto}`}>
        {pago ? 'Paga' : `${situacaoDoHonorario(hon.status) === 'OVERDUE' ? 'Venceu' : 'Vence'} em ${dia(hon.dueDate)}`}
      </p>
      <p className="w-28 shrink-0 text-right text-sm font-serif tabular font-bold text-ink">{BRL.format(hon.value)}</p>
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
