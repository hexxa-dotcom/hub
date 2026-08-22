'use client';

import { useState } from 'react';
import {
  CreditCard, QrCode, CheckCircle, WarningCircle, Clock, FileText, DownloadSimple, ArrowSquareOut,
} from '@phosphor-icons/react';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import type { PlanoAtual } from './actions';
import type { AsaasPayment } from '@/lib/asaas';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG: Record<NonNullable<PlanoAtual>['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Contrato em dia', cls: 'bg-ok/20 text-emerald-200' },
  TRIAL: { label: 'Em período de teste', cls: 'bg-brand-500/20 text-white' },
  PAST_DUE: { label: 'Pagamento em atraso', cls: 'bg-critical/20 text-red-200' },
  CANCELED: { label: 'Cancelado', cls: 'bg-white/20 text-white/80' },
};

const PAYMENT_STATUS_LABEL: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  RECEIVED: { label: 'Pago', cls: 'bg-ok/10 text-ok', icon: CheckCircle },
  CONFIRMED: { label: 'Pago', cls: 'bg-ok/10 text-ok', icon: CheckCircle },
  PENDING: { label: 'Pendente', cls: 'bg-warn/10 text-warn', icon: Clock },
  OVERDUE: { label: 'Atrasado', cls: 'bg-critical/10 text-critical', icon: WarningCircle },
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function MeuPlanoClient({ plano, cobrancas }: { plano: PlanoAtual; cobrancas: AsaasPayment[] }) {
  const [showPixModal, setShowPixModal] = useState(false);

  if (!plano) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <p className="text-ink-soft font-medium">Nenhuma assinatura encontrada ainda.</p>
        <p className="text-ink-soft/70 text-sm mt-1">Sua contabilidade ativa o plano assim que o cadastro é concluído.</p>
      </div>
    );
  }

  const st = STATUS_CONFIG[plano.status];

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 💳 CARD DE RESUMO DO PLANO ATIVO */}
      <div className="rounded-3xl border border-brand-400/40 bg-gradient-to-br from-brand-600 to-brand-700 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                Plano Contratado
              </span>
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
                <CheckCircle className="h-3.5 w-3.5" /> {st.label}
              </span>
            </div>

            <h2 className="text-3xl font-extrabold">{plano.planoNome}</h2>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/90">
              {plano.periodoFim && (
                <span>Período atual até: <strong>{fmtDate(plano.periodoFim)}</strong></span>
              )}
            </div>
          </div>

          <div className="text-left md:text-right shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl">
            <p className="text-xs text-white/70 font-medium">Mensalidade do Plano</p>
            <p className="text-4xl font-extrabold mt-1">{BRL.format(plano.mensalidade)}<span className="text-sm font-normal text-white/80">/mês</span></p>
            <button
              type="button"
              onClick={() => setShowPixModal(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-brand-700 px-4 py-2 text-xs font-bold hover:bg-white/90 transition-colors shadow-md"
            >
              <QrCode className="h-4 w-4" /> Pagar Mensalidade via Pix
            </button>
          </div>
        </div>
      </div>

      {/* Forma de pagamento — honesto sobre o que existe hoje */}
      <section className="rounded-2xl border border-line bg-surface-card p-6 space-y-3">
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-500" />
          Forma de Pagamento
        </h3>
        <p className="text-sm text-ink-soft">
          Hoje o pagamento é feito via Pix (Asaas). Cartão de crédito com débito automático ainda não está disponível — se quiser mudar de plano ou forma de cobrança, fale com sua contabilidade em <a href="/suporte" className="text-brand-600 hover:underline dark:text-brand-400">Suporte</a>.
        </p>
      </section>

      {/* 📄 HISTÓRICO REAL DE COBRANÇAS (Asaas) */}
      <section className="rounded-2xl border border-line bg-surface-card p-6 space-y-4">
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-500" />
          Histórico de Cobranças
        </h3>

        {cobrancas.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhuma cobrança encontrada ainda.</p>
        ) : (
          <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {cobrancas.map((c) => {
              const cfg = PAYMENT_STATUS_LABEL[c.status] ?? { label: c.status, cls: 'bg-ink/10 text-ink-soft', icon: Clock };
              const StatusIcon = cfg.icon;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between p-4 bg-surface-card hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">Vencimento {fmtDate(c.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-extrabold text-ink">{BRL.format(c.value)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${cfg.cls}`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {c.invoiceUrl && (
                      <a href={c.invoiceUrl} target="_blank" rel="noreferrer"
                        className="p-2 rounded-xl text-ink-soft hover:text-brand-600 hover:bg-brand-500/10" title="Ver fatura no Asaas">
                        <DownloadSimple className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <ArrowSquareOut className="h-3 w-3" /> Dados vindos direto do Asaas, sua processadora de cobrança.
        </p>
      </section>

      {showPixModal && (
        <GeneratePixModal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          initialDescription={`Mensalidade Contábil — ${plano.planoNome}`}
        />
      )}
    </div>
  );
}
