'use client';

import { useState } from 'react';
import { 
  CreditCard, QrCode, CheckCircle, WarningCircle, Clock, ShieldCheck, 
  Sparkle, Check, ArrowRight, LockKey, FileText, DownloadSimple, Plus, X, CaretRight, Building
} from '@phosphor-icons/react';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type SubscriptionPlan = {
  id: string;
  name: string;
  regime: 'Simples Nacional' | 'Lucro Presumido';
  tier: 'Essencial' | 'Pro';
  monthlyValue: number;
  description: string;
  features: string[];
  recommended?: boolean;
};

const ALL_PLANS: SubscriptionPlan[] = [
  {
    id: 'sn-essencial',
    name: 'Simples Nacional Essencial',
    regime: 'Simples Nacional',
    tier: 'Essencial',
    monthlyValue: 249,
    description: 'Ideal para autônomos e pequenos prestadores de serviços.',
    features: [
      'Contabilidade completa & DAS mensal',
      'Até R$ 30 mil/mês de faturamento',
      'Emissão de até 20 NFS-e/mês',
      'Pró-labore de até 2 sócios',
      'Acesso total ao Hub Financeiro',
    ],
  },
  {
    id: 'sn-pro',
    name: 'Simples Nacional Pro',
    regime: 'Simples Nacional',
    tier: 'Pro',
    monthlyValue: 399,
    description: 'Para empresas de serviços em crescimento com alta demanda fiscal.',
    features: [
      'Contabilidade completa & Economizador Fator R',
      'Faturamento ilimitado no Simples',
      'Emissão Ilimitada de NFS-e',
      'Folha de pagamento & Pró-labore até 5 sócios',
      'Suporte prioritário via WhatsApp',
      'Consultoria tributária trimestral',
    ],
    recommended: true,
  },
  {
    id: 'lp-essencial',
    name: 'Lucro Presumido Essencial',
    regime: 'Lucro Presumido',
    tier: 'Essencial',
    monthlyValue: 499,
    description: 'Para empresas tributadas no Lucro Presumido com operação enxuta.',
    features: [
      'Apuração de PIS, COFINS, IRPJ e CSLL',
      'SPED Fiscal & EFD Contribuições',
      'Emissão de até 50 NFS-e/mês',
      'Balanço Anual e DRE Contábil',
    ],
  },
  {
    id: 'lp-pro',
    name: 'Lucro Presumido Pro',
    regime: 'Lucro Presumido',
    tier: 'Pro',
    monthlyValue: 799,
    description: 'Solução corporativa completa para clínicas, consultorias e empresas maiores.',
    features: [
      'Contabilidade completa Lucro Presumido',
      'Apuração Fiscal & SPED Ilimitado',
      'Emissão Ilimitada de NFS-e',
      'Folha de pagamento completa',
      'Gerente de conta dedicado',
      'Reunião mensal de alinhamento estratégico',
    ],
    recommended: true,
  },
];

type Invoice = {
  id: string;
  month: string;
  value: number;
  status: 'PAGO' | 'PENDENTE';
  paymentMethod: 'Cartão de Crédito' | 'Pix';
  paidAt?: string;
};

const INITIAL_INVOICES: Invoice[] = [
  { id: 'inv-07', month: 'Julho / 2026', value: 399, status: 'PAGO', paymentMethod: 'Pix', paidAt: '2026-07-05' },
  { id: 'inv-06', month: 'Junho / 2026', value: 399, status: 'PAGO', paymentMethod: 'Cartão de Crédito', paidAt: '2026-06-05' },
  { id: 'inv-05', month: 'Maio / 2026', value: 399, status: 'PAGO', paymentMethod: 'Cartão de Crédito', paidAt: '2026-05-05' },
];

export function MeuPlanoClient() {
  const [selectedRegime, setSelectedRegime] = useState<'Simples Nacional' | 'Lucro Presumido'>('Simples Nacional');
  const [currentPlanId, setCurrentPlanId] = useState('sn-pro');
  const [invoices] = useState<Invoice[]>(INITIAL_INVOICES);
  
  // Cartão e Pagamento
  const [savedCard, setSavedCard] = useState<{ last4: string; brand: string; expiry: string } | null>({
    last4: '4829',
    brand: 'Mastercard',
    expiry: '08/28',
  });
  
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);

  // Planos filtrados EXCLUSIVAMENTE pelo regime fiscal da empresa do cliente
  const regimePlans = ALL_PLANS.filter(p => p.regime === selectedRegime);
  const currentPlan = ALL_PLANS.find(p => p.id === currentPlanId) ?? regimePlans[1] ?? regimePlans[0]!;

  function handleSaveCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = String(fd.get('cardNumber')).replace(/\D/g, '');
    const last4 = num.slice(-4) || '9999';
    const expiry = String(fd.get('expiry'));

    setSavedCard({
      last4,
      brand: 'Visa',
      expiry,
    });
    setShowAddCardModal(false);
    setCardSuccess('Cartão de crédito cadastrado com sucesso! As próximas mensalidades serão debitadas automaticamente.');
    setTimeout(() => setCardSuccess(null), 5000);
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {cardSuccess && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 border border-ok/30 p-4 text-sm text-ok font-medium">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {cardSuccess}
        </div>
      )}

      {/* Seletor de Regime Fiscal da Empresa */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <Building className="h-5 w-5 text-brand-500" />
            Regime Fiscal da Sua Empresa
          </h2>
          <p className="text-xs text-ink-soft">Exibindo os planos específicos do seu enquadramento tributário</p>
        </div>

        <div className="flex gap-1 rounded-xl border border-line bg-surface-card p-1">
          <button
            type="button"
            onClick={() => {
              setSelectedRegime('Simples Nacional');
              setCurrentPlanId('sn-pro');
            }}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              selectedRegime === 'Simples Nacional'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Simples Nacional
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRegime('Lucro Presumido');
              setCurrentPlanId('lp-pro');
            }}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              selectedRegime === 'Lucro Presumido'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Lucro Presumido
          </button>
        </div>
      </div>

      {/* 💳 CARD DE RESUMO DO PLANO ATIVO */}
      <div className="rounded-3xl border border-brand-400/40 bg-gradient-to-br from-brand-600 to-brand-700 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                Plano Contratado Ativo
              </span>
              <span className="flex items-center gap-1 rounded-full bg-ok/20 px-3 py-1 text-xs font-bold text-emerald-200">
                <CheckCircle className="h-3.5 w-3.5" /> Contrato Em Dia
              </span>
            </div>

            <h2 className="text-3xl font-extrabold">{currentPlan.name}</h2>
            <p className="text-sm text-white/80 mt-1 max-w-xl">{currentPlan.description}</p>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/90">
              <span>Vigência Contratual: <strong>Até 31/12/2026</strong></span>
              <span>•</span>
              <span>Regime Fiscal: <strong>{currentPlan.regime}</strong></span>
              <span>•</span>
              <span>Renovação Automática: <strong>Todo dia 05</strong></span>
            </div>
          </div>

          <div className="text-left md:text-right shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl">
            <p className="text-xs text-white/70 font-medium">Mensalidade do Plano</p>
            <p className="text-4xl font-extrabold mt-1">{BRL.format(currentPlan.monthlyValue)}<span className="text-sm font-normal text-white/80">/mês</span></p>
            <button
              type="button"
              onClick={() => setShowPixModal(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-brand-700 px-4 py-2 text-xs font-bold hover:bg-white/90 transition-colors shadow-md"
            >
              <QrCode className="h-4 w-4" /> Pagar Mensalidade via Pix
            </button>
          </div>
        </div>

        {/* Itens Inclusos no Contrato */}
        <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {currentPlan.features.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-white/95">
              <Check className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 💳 FORMAS DE PAGAMENTO & CARTÃO DE CRÉDITO */}
      <section className="rounded-2xl border border-line bg-surface-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-brand-500" />
              Forma de Pagamento da Mensalidade
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">Cadastre seu cartão para débito automático ou pague via Pix instantâneo</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCardModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 shadow-sm"
          >
            <Plus className="h-4 w-4" /> {savedCard ? 'Alterar Cartão' : 'Adicionar Cartão de Crédito'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card de Cartão Salvo */}
          <div className="rounded-2xl border border-line bg-black/5 dark:bg-white/5 p-5 space-y-3">
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Cartão Cadastrado</p>
            {savedCard ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-14 rounded-xl bg-brand-600 text-white font-bold text-xs flex items-center justify-center shadow">
                    {savedCard.brand}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">•••• •••• •••• {savedCard.last4}</p>
                    <p className="text-xs text-ink-soft">Validade: {savedCard.expiry}</p>
                  </div>
                </div>
                <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-bold text-ok">Principal</span>
              </div>
            ) : (
              <p className="text-xs text-ink-soft">Nenhum cartão salvo ainda. Adicione um cartão para evitar esquecimentos.</p>
            )}
          </div>

          {/* Card de Pagamento Pix */}
          <div className="rounded-2xl border border-line bg-black/5 dark:bg-white/5 p-5 space-y-3">
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Pagamento via Pix</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-ink">Pix Copia e Cola / QR Code</p>
                <p className="text-xs text-ink-soft">Gere o QR Code e receba o comprovante na hora</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPixModal(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20"
              >
                <QrCode className="h-4 w-4" /> Gerar Pix
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 📄 HISTÓRICO DE MENSALIDADES & FATURAS */}
      <section className="rounded-2xl border border-line bg-surface-card p-6 space-y-4">
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-500" />
          Histórico de Mensalidades do Sistema
        </h3>

        <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
          {invoices.map(inv => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between p-4 bg-surface-card hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-3">
              <div>
                <p className="text-sm font-bold text-ink">{inv.month}</p>
                <p className="text-xs text-ink-soft">Forma: {inv.paymentMethod} · Pago em {inv.paidAt}</p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-base font-extrabold text-ink">{BRL.format(inv.value)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-3 py-1 text-xs font-bold text-ok">
                  <CheckCircle className="h-3.5 w-3.5" /> Pago
                </span>
                <button
                  type="button"
                  onClick={() => alert(`Baixando recibo oficial da mensalidade ${inv.month}...`)}
                  className="p-2 rounded-xl text-ink-soft hover:text-brand-600 hover:bg-brand-500/10"
                  title="Baixar Recibo"
                >
                  <DownloadSimple className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🚀 PLANOS DO REGIME (Essencial vs Pro) */}
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-ink">Planos do seu Regime ({selectedRegime})</h3>
          <p className="text-xs text-ink-soft">Alterne entre as opções Essencial e Pro de acordo com a sua necessidade</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regimePlans.map(p => {
            const isSelected = p.id === currentPlanId;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                  isSelected 
                    ? 'border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20 shadow-lg' 
                    : 'border-line bg-surface-card hover:border-brand-400/40'
                }`}
              >
                <div>
                  {p.recommended && (
                    <span className="inline-block rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-extrabold text-white mb-2 uppercase">
                      Mais Recomendado
                    </span>
                  )}
                  <h4 className="text-lg font-bold text-ink">{p.name}</h4>
                  <p className="text-xs text-ink-soft mt-1">{p.description}</p>

                  <p className="text-3xl font-extrabold text-brand-600 dark:text-brand-400 mt-4">
                    {BRL.format(p.monthlyValue)}<span className="text-xs font-normal text-ink-soft">/mês</span>
                  </p>

                  <ul className="mt-5 space-y-2.5 text-xs text-ink-soft border-t border-line pt-4">
                    {p.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 shrink-0 text-ok mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPlanId(p.id)}
                  disabled={isSelected}
                  className={`mt-6 w-full rounded-xl py-2.5 text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-ok/10 text-ok cursor-default'
                      : 'bg-brand-500 text-white hover:bg-brand-600'
                  }`}
                >
                  {isSelected ? 'Plano Atual' : 'Migrar para este Plano'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL ADICIONAR CARTÃO */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveCard} className="w-full max-w-md rounded-2xl bg-surface-card border border-line p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-brand-500" />
                Cadastrar Cartão de Crédito
              </h3>
              <button type="button" onClick={() => setShowAddCardModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Número do Cartão *</label>
              <input name="cardNumber" required placeholder="0000 0000 0000 0000" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft">Nome Impresso no Cartão *</label>
              <input name="holderName" required placeholder="COMO ESTÁ NO CARTÃO" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 uppercase" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-soft">Validade *</label>
                <input name="expiry" required placeholder="MM/AA" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">CVV *</label>
                <input name="cvv" required type="password" maxLength={4} placeholder="123" className="mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-ink-soft pt-1">
              <LockKey className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Seus dados são armazenados com criptografia de ponta a ponta via Asaas.</span>
            </div>

            <button type="submit" className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Salvar Cartão Seguro
            </button>
          </form>
        </div>
      )}

      {/* MODAL PIX */}
      {showPixModal && (
        <GeneratePixModal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          initialDescription={`Mensalidade Contábil — ${currentPlan.name}`}
        />
      )}
    </div>
  );
}
