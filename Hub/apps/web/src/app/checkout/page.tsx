'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import './checkout.css';
import { formatDocument } from '@hexxa/core/document-br';

interface PlanInfo {
  id: string;
  name: string;
  badge?: string;
  price: string;
  period: string;
  desc: string;
  benefits: string[];
}

const plansData: Record<'gestao' | 'completo' | 'holding', PlanInfo> = {
  gestao: {
    id: 'gestao',
    name: 'Hub Gestão',
    price: 'R$ 149',
    period: '/mês',
    desc: 'Plataforma completa de controle operacional para quem já possui contador próprio.',
    benefits: [
      'Fluxo de caixa em tempo real & conciliação bancária',
      'Emissão de Notas Fiscais de Serviço (NFSe)',
      'Modelos de contratos prontos para prestação de serviços',
      'Assinatura digital com validade jurídica (ICP-Brasil)',
      'Cofre seguro para armazenamento de documentos e guias',
      'Suporte técnico multicanal (WhatsApp e e-mail)',
    ],
  },
  completo: {
    id: 'completo',
    name: 'Hub + Contabilidade Completa',
    badge: 'Mais Escolhido',
    price: 'R$ 389',
    period: '/mês',
    desc: 'O hub tudo-em-um com contabilidade consultiva e impostos inclusos.',
    benefits: [
      'Tudo do Hub Gestão incluso na mesma assinatura',
      'Contabilidade consultiva com contador dedicado à sua empresa',
      'Cálculo e geração automática de impostos (DAS) sem atrasos',
      'Entrega de todas as obrigações acessórias (DEFIS, DCTF, etc.)',
      'Abertura de CNPJ grátis ou migração sem burocracia do contador antigo',
      'Planejamento tributário para redução legal da carga de impostos',
      'Atendimento humano prioritário no dia a dia',
    ],
  },
  holding: {
    id: 'holding',
    name: 'Holding & Patrimonial',
    price: 'R$ 890',
    period: '/mês',
    desc: 'Estruturação societária e gestão patrimonial para famílias e administradoras de bens.',
    benefits: [
      'Gestão consolidada de múltiplos imóveis e contratos de locação',
      'Contabilidade societária especializada em holdings',
      'Planejamento de proteção patrimonial e sucessória',
      'Relatórios e DRE de rendimentos consolidados',
      'Consultoria contábil e jurídica sob medida com especialista sênior',
    ],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const planParam = searchParams.get('plan') as keyof typeof plansData;
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof plansData>(
    planParam && plansData[planParam] ? planParam : 'completo'
  );

  useEffect(() => {
    if (planParam && plansData[planParam]) {
      setSelectedPlan(planParam);
    }
  }, [planParam]);

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    email: '',
    whats: '',
    documento: '',
    empresa: '',
  });

  const plan = plansData[selectedPlan];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    setForm((prev) => ({ ...prev, whats: v }));
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, documento: formatDocument(e.target.value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.whats) return;

    setLoading(true);

    try {
      // Save lead / pre-order
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          whats: form.whats,
          area: `Plano ${plan.name} (${paymentMethod.toUpperCase()}) - Doc: ${form.documento}`,
        }),
      });
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
    setCompleted(true);
  };

  return (
    <div className="checkout-page">
      {/* Checkout Navbar */}
      <header className="checkout-header">
        <div className="wrap">
          <Link href="/" className="checkout-logo">
            <span className="logo-flex">
              <b className="logo-main">hexx</b>
              <span className="logo-tag-hub">HUB</span>
            </span>
          </Link>
          <div className="checkout-security-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>Ambiente Seguro 256-bit</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="checkout-main">
        {/* Left Column: Summary & Value Props */}
        <section className="checkout-summary-card">
          <div className="checkout-plan-tabs">
            <button
              className={`checkout-plan-tab ${selectedPlan === 'gestao' ? 'active' : ''}`}
              onClick={() => setSelectedPlan('gestao')}
            >
              Hub Gestão
            </button>
            <button
              className={`checkout-plan-tab ${selectedPlan === 'completo' ? 'active' : ''}`}
              onClick={() => setSelectedPlan('completo')}
            >
              Hub + Contabilidade ★
            </button>
            <button
              className={`checkout-plan-tab ${selectedPlan === 'holding' ? 'active' : ''}`}
              onClick={() => setSelectedPlan('holding')}
            >
              Holding
            </button>
          </div>

          <div>
            {plan.badge && <span className="checkout-plan-pill">{plan.badge}</span>}
            <h1 className="checkout-plan-title">{plan.name}</h1>
            <p className="checkout-plan-desc">{plan.desc}</p>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--lime)', marginBottom: '16px' }}>
              O que está incluso na sua assinatura:
            </h3>
            <ul className="checkout-benefits-list">
              {plan.benefits.map((b, i) => (
                <li key={i} className="checkout-benefit-item">
                  <span className="ck">
                    <svg width="10" height="8" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M1 5l3.5 3.5L11 1" />
                    </svg>
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Guarantee Box */}
          <div className="checkout-guarantee-box">
            <div className="checkout-guarantee-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="checkout-guarantee-text">
              <b>Garantia Incondicional de 7 Dias</b>
              <span>
                Experimente o Hub sem nenhum risco. Cancele a qualquer momento sem burocracia ou multas.
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Checkout Form */}
        <section className="checkout-form-card">
          {!completed ? (
            <form onSubmit={handleSubmit} noValidate>
              <div className="checkout-form-head">
                <h2>Finalizar Contratação</h2>
                <p>Preencha seus dados para configurar a sua empresa no Hub.</p>
              </div>

              {/* Price summary box */}
              <div className="checkout-price-box">
                <div>
                  <div className="lbl">Valor da Mensalidade</div>
                  <div style={{ fontSize: '12px', color: '#6E6A61', marginTop: '2px' }}>
                    Sem fidelidade · Cancele quando quiser
                  </div>
                </div>
                <div className="price">
                  {plan.price}
                  <span>{plan.period}</span>
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="nome">Nome Completo</label>
                <input
                  id="nome"
                  type="text"
                  placeholder="Seu nome completo"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="email">E-mail Profissional</label>
                <input
                  id="email"
                  type="email"
                  placeholder="voce@suaempresa.com.br"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="checkout-field">
                  <label htmlFor="whats">WhatsApp</label>
                  <input
                    id="whats"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    required
                    value={form.whats}
                    onChange={handlePhoneChange}
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="documento">CPF ou CNPJ</label>
                  <input
                    id="documento"
                    type="text"
                    placeholder="000.000.000-00"
                    value={form.documento}
                    onChange={handleDocChange}
                  />
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="empresa">Nome da Empresa ou Razão Social (Opcional)</label>
                <input
                  id="empresa"
                  type="text"
                  placeholder="Ex: Minha Consultoria Ltda"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
              </div>

              <div style={{ margin: '22px 0 12px 0' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6E6A61', display: 'block', marginBottom: '8px' }}>
                  Forma de Pagamento
                </label>
                <div className="checkout-payment-methods">
                  <button
                    type="button"
                    className={`checkout-pay-btn ${paymentMethod === 'pix' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('pix')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <span>Pix (Instantâneo)</span>
                  </button>

                  <button
                    type="button"
                    className={`checkout-pay-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    <span>Cartão de Crédito</span>
                  </button>
                </div>
              </div>

              <button type="submit" className="checkout-submit-btn" disabled={loading}>
                {loading ? (
                  'Processando...'
                ) : (
                  <>
                    <span>Confirmar &amp; Ativar Meu Hub</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              <p className="checkout-footer-note">
                🔒 Seus dados estão protegidos por criptografia SSL 256-bit. A ativação do seu painel e onboarding contábil serão iniciados imediatamente.
              </p>
            </form>
          ) : (
            <div className="checkout-success-view">
              <div className="checkout-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h2 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '10px' }}>
                Assinatura Confirmada!
              </h2>

              <p style={{ fontSize: '15px', color: '#6E6A61', lineHeight: 1.6, marginBottom: '28px' }}>
                Parabéns, <b>{form.nome}</b>! O seu plano <b>{plan.name}</b> foi registrado com sucesso. Nossa equipe já está iniciando a configuração do seu Hub.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a
                  href={`https://wa.me/5500000000000?text=${encodeURIComponent(
                    `Olá, acabei de contratar o ${plan.name} para ${form.nome} (${form.empresa || form.email}). Gostaria de iniciar o onboarding do Hub!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-landing btn-landing-lime"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Falar com Meu Especialista no WhatsApp ↗
                </a>

                <Link
                  href={'/sign-in' as any}
                  className="btn-landing btn-landing-dark"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Ir para Tela de Login →
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#14120B] flex items-center justify-center text-white">Carregando Checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
