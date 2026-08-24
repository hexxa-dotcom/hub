import Link from 'next/link';
import { FeatureComparisonTable } from './FeatureComparisonTable';

export function PricingSection() {
  const plans = [
    {
      name: 'Hub Start',
      tagline: 'Autogestão & Controle',
      desc: 'Para quem já tem contabilidade externa e busca a melhor plataforma de gestão, notas fiscais e contratos.',
      price: 'R$ 149',
      period: '/mês',
      featured: false,
      ctaText: 'Começar com Hub Start',
      ctaHref: '/checkout?plan=gestao',
      ctaClass: 'btn-landing-dark',
      features: [
        'Emissão ilimitada de NFSe com 1 clique',
        'Fluxo de caixa & conciliação bancária',
        'Contratos digitais com assinatura jurídica',
        'Cofre inteligente de certidões e arquivos',
        'DRE e relatórios de lucro em tempo real',
        'Suporte prioritário por WhatsApp e e-mail',
      ],
    },
    {
      name: 'Hub Pro + Contabilidade',
      badge: 'Mais Escolhido • Completo',
      tagline: 'Autogestão + Contador Dedicado',
      desc: 'A experiência definitiva: a plataforma do Hub integrada a uma assessoria contábil consultiva e estratégica.',
      price: 'R$ 389',
      period: '/mês',
      featured: true,
      ctaText: 'Contratar Hub Pro',
      ctaHref: '/checkout?plan=completo',
      ctaClass: 'btn-landing-lime',
      features: [
        'Tudo incluso do plano Hub Start',
        'Contador dedicado no WhatsApp da sua empresa',
        'Cálculo e guias automáticas de impostos (DAS)',
        'Declarações obrigatórias (DEFIS, DCTF, etc.)',
        'Abertura de CNPJ ou migração grátis',
        'Planejamento tributário consultivo contínuo',
        'Pró-labore e folha de sócios inclusos',
      ],
    },
    {
      name: 'Holding & Private',
      tagline: 'Gestão Patrimonial & Societária',
      desc: 'Estruturação, blindagem patrimonial e contabilidade societária para famílias e administradoras de bens.',
      price: 'R$ 890',
      period: '/mês',
      featured: false,
      ctaText: 'Contratar Holding & Private',
      ctaHref: '/checkout?plan=holding',
      ctaClass: 'btn-landing-dark',
      features: [
        'Gestão de múltiplos imóveis e aluguéis',
        'Contabilidade societária e fiscal especializada',
        'Planejamento tributário e sucessório exclusivo',
        'Demonstrativos consolidados de rendimentos',
        'Atendimento prioritário com sócio especialista',
        'Assessoria contábil para reorganização societária',
      ],
    },
  ];

  return (
    <section className="pricing-sec" id="planos">
      <div className="landing-wrap">
        <div className="pricing-head reveal in">
          <span className="hero-eyebrow">Planos Transparentes</span>
          <h2 className="landing-serif">Sem taxas ocultas. Sem surpresas no fim do mês.</h2>
          <p>
            Escolha o modelo que melhor atende o momento da sua empresa. Sem fidelidade contratual.
          </p>
        </div>

        <div className="pricing-grid reveal in">
          {plans.map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
              <div>
                {plan.tagline && (
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: plan.featured ? 'var(--lime)' : '#2F4A3C' }}>
                      {plan.tagline}
                    </span>
                  </div>
                )}
                <h3 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>{plan.name}</h3>
                <p className="p-desc">{plan.desc}</p>
                <div className="price">
                  {plan.price} <span>{plan.period}</span>
                </div>

                <ul className="pricing-features">
                  {plan.features.map((feat, idx) => (
                    <li key={idx}>
                      <span className="ck">
                        <svg width="10" height="8" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M1 5l3.5 3.5L11 1" />
                        </svg>
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Link href={plan.ctaHref as any} className={`btn-landing ${plan.ctaClass}`}>
                  {plan.ctaText} →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Comparison Matrix */}
        <FeatureComparisonTable />
      </div>
    </section>
  );
}
