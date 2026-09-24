'use client';

import { useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import type { PlanoAtual } from './actions';
import type { AsaasPayment } from '@/lib/asaas';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG: Record<NonNullable<PlanoAtual>['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Contrato em dia', cls: 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)' },
  TRIAL: { label: 'Em período de teste', cls: 'bg-surface-card text-ink shadow-(--elev-inset)' },
  PAST_DUE: { label: 'Pagamento em atraso', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' },
  CANCELED: { label: 'Cancelado', cls: 'bg-surface-card text-ink-soft' },
};

const PAYMENT_STATUS_LABEL: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  RECEIVED: { label: 'Pago', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  CONFIRMED: { label: 'Pago', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', icon: CheckCircle2 },
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20', icon: Clock },
  OVERDUE: { label: 'Atrasado', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20', icon: AlertTriangle },
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function MeuPlanoClient({ plano, cobrancas }: { plano: PlanoAtual; cobrancas: AsaasPayment[] }) {
  const [showPixModal, setShowPixModal] = useState(false);

  if (!plano) {
    return (
      <Card level={1} className="p-12 text-center border-dashed">
        <p className="font-serif font-bold text-base text-ink">Nenhuma assinatura encontrada ainda.</p>
        <p className="text-xs text-ink-soft mt-1">Sua contabilidade ativa o plano assim que o cadastro é concluído.</p>
      </Card>
    );
  }

  const st = STATUS_CONFIG[plano.status];

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 💳 CARD DE RESUMO DO PLANO ATIVO */}
      <Card level={2} tone="deep" className="p-6 sm:p-8 relative overflow-hidden card-finish">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset) px-3 py-1 text-caption font-bold uppercase tracking-wider">
                Plano Contratado
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {st.label}
              </span>
            </div>

            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-ink tracking-tight">{plano.planoNome}</h2>

            <div className="pt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
              {plano.periodoFim && (
                <span>Período atual até: <strong className="text-ink">{fmtDate(plano.periodoFim)}</strong></span>
              )}
            </div>
          </div>

          <div className="text-left md:text-right shrink-0 bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-6 rounded-3xl space-y-2">
            <p className="rotulo text-ink-soft">Mensalidade do Plano</p>
            <p className="font-serif tabular text-3xl sm:text-4xl font-bold text-ink">{BRL.format(plano.mensalidade)}<span className="text-xs font-sans font-normal text-ink-soft">/mês</span></p>
            <button
              type="button"
              onClick={() => setShowPixModal(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 active:scale-95 px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
            >
              <QrCode className="h-4 w-4" /> Pagar Mensalidade via Pix
            </button>
          </div>
        </div>
      </Card>

      {/* Forma de pagamento */}
      <Card level={1} className="p-6 sm:p-8 space-y-3">
        <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" />
          Forma de Pagamento
        </h3>
        <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
          Atualmente o faturamento é processado via Pix e Boleto bancário (Asaas). Para alterar dados cadastrais de cobrança ou emitir segunda via, fale com nossa equipe em <a href="/suporte" className="font-bold text-hexxa-forest hover:underline dark:text-hexxa-lime">Suporte</a>.
        </p>
      </Card>

      {/* 📄 HISTÓRICO REAL DE COBRANÇAS (Asaas) */}
      <Card level={1} className="p-6 sm:p-8 space-y-4">
        <h3 className="font-serif font-bold text-base text-ink flex items-center gap-2">
          <FileText className="h-5 w-5 text-hexxa-forest dark:text-hexxa-lime" />
          Histórico de Cobranças
        </h3>

        {cobrancas.length === 0 ? (
          <p className="text-xs sm:text-sm text-ink-soft py-4">Nenhuma cobrança encontrada ainda.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-surface-card shadow-(--elev-1)">
            {cobrancas.map((c) => {
              const cfg = PAYMENT_STATUS_LABEL[c.status] ?? { label: c.status, cls: 'bg-surface-card text-ink-soft', icon: Clock };
              const StatusIcon = cfg.icon;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between p-4 hover:bg-surface-card-hover transition-colors gap-3">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-ink">Vencimento {fmtDate(c.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-serif tabular text-base font-bold text-ink">{BRL.format(c.value)}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.cls}`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {c.invoiceUrl && (
                      <a
                        href={c.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="tap-target pressable focusable rounded-full p-2 text-ink-soft hover:bg-surface-card-hover hover:text-ink transition-colors"
                        title="Ver fatura no Asaas"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-ink-soft pt-1">
          <ExternalLink className="h-3 w-3" /> Faturamento sincronizado em tempo real com o Asaas.
        </p>
      </Card>

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

