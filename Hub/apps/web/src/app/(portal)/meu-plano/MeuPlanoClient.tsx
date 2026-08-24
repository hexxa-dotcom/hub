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
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';
import type { PlanoAtual } from './actions';
import type { AsaasPayment } from '@/lib/asaas';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG: Record<NonNullable<PlanoAtual>['status'], { label: string; cls: string }> = {
  ACTIVE: { label: 'Contrato em dia', cls: 'bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]' },
  TRIAL: { label: 'Em período de teste', cls: 'bg-white/20 text-[#DFFFAE]' },
  PAST_DUE: { label: 'Pagamento em atraso', cls: 'bg-red-500/20 text-red-200' },
  CANCELED: { label: 'Cancelado', cls: 'bg-white/20 text-white/80' },
};

const PAYMENT_STATUS_LABEL: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  RECEIVED: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  CONFIRMED: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: Clock },
  OVERDUE: { label: 'Atrasado', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: AlertTriangle },
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function MeuPlanoClient({ plano, cobrancas }: { plano: PlanoAtual; cobrancas: AsaasPayment[] }) {
  const [showPixModal, setShowPixModal] = useState(false);

  if (!plano) {
    return (
      <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center">
        <p className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nenhuma assinatura encontrada ainda.</p>
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Sua contabilidade ativa o plano assim que o cadastro é concluído.</p>
      </div>
    );
  }

  const st = STATUS_CONFIG[plano.status];

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 💳 CARD DE RESUMO DO PLANO ATIVO */}
      <div className="rounded-3xl border border-black/5 bg-[#1E3328] dark:bg-[#1A201C] p-6 sm:p-8 text-[#FEFDF3] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#DFFFAE] backdrop-blur-md">
                Plano Contratado
              </span>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {st.label}
              </span>
            </div>

            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#DFFFAE] tracking-tight">{plano.planoNome}</h2>

            <div className="pt-2 flex flex-wrap gap-4 text-xs text-[#DFFFAE]/80">
              {plano.periodoFim && (
                <span>Período atual até: <strong>{fmtDate(plano.periodoFim)}</strong></span>
              )}
            </div>
          </div>

          <div className="text-left md:text-right shrink-0 bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/15 p-6 rounded-3xl space-y-2">
            <p className="text-xs text-[#DFFFAE]/80 font-bold uppercase tracking-wider">Mensalidade do Plano</p>
            <p className="font-serif text-3xl sm:text-4xl font-bold text-[#DFFFAE]">{BRL.format(plano.mensalidade)}<span className="text-xs font-normal text-white/80">/mês</span></p>
            <button
              type="button"
              onClick={() => setShowPixModal(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#DFFFAE] text-[#1E3328] hover:bg-white px-5 py-2.5 text-xs font-bold transition-all shadow-md hover:scale-105"
            >
              <QrCode className="h-4 w-4" /> Pagar Mensalidade via Pix
            </button>
          </div>
        </div>
      </div>

      {/* Forma de pagamento */}
      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-3 shadow-sm">
        <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          Forma de Pagamento
        </h3>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] leading-relaxed">
          Atualmente o faturamento é processado via Pix e Boleto bancário (Asaas). Para alterar dados cadastrais de cobrança ou emitir segunda via, fale com nossa equipe em <a href="/suporte" className="font-bold text-[#2F4A3C] dark:text-[#DFFFAE] hover:underline">Suporte</a>.
        </p>
      </section>

      {/* 📄 HISTÓRICO REAL DE COBRANÇAS (Asaas) */}
      <section className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
        <h3 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3] flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          Histórico de Cobranças
        </h3>

        {cobrancas.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] py-4">Nenhuma cobrança encontrada ainda.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#121614]">
            {cobrancas.map((c) => {
              const cfg = PAYMENT_STATUS_LABEL[c.status] ?? { label: c.status, cls: 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]', icon: Clock };
              const StatusIcon = cfg.icon;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-3">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Vencimento {fmtDate(c.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3]">{BRL.format(c.value)}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.cls}`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {c.invoiceUrl && (
                      <a
                        href={c.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full p-2 text-[#6E6A61] hover:bg-[#1E3328]/10 hover:text-[#1E3328] dark:hover:text-[#DFFFAE]"
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
        <p className="flex items-center gap-1.5 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
          <ExternalLink className="h-3 w-3" /> Faturamento sincronizado em tempo real com o Asaas.
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

