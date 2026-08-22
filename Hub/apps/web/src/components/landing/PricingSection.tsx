import Link from 'next/link';
import { FeatureComparisonTable } from './FeatureComparisonTable';

export function PricingSection() {
  const plans = [
    {
      name: 'Hub Gestão',
      desc: 'Para quem já tem contabilidade e precisa apenas da plataforma de controle.',
      price: 'R$ 149',
      period: '/mês',
      featured: false,
      ctaText: 'Começar com Gestão',
      ctaHref: '/checkout?plan=gestao',
      ctaClass: 'btn-landing-dark',
      features: [
        'Fluxo de caixa & conciliação',
        'Contratos & assinaturas digitais',
        'Emissão de notas fiscais (NFSe)',
        'Cofre de documentos',
        'Suporte por WhatsApp e e-mail',
      ],
    },
    {
      name: 'Hub + Contabilidade Completa',
      badge: 'Mais Escolhido',
      desc: 'O hub tudo-em-um com contabilidade consultiva e impostos inclusos.',
      price: 'R$ 389',
      period: '/mês',
      featured: true,
      ctaText: 'Contratar com Contabilidade',
      ctaHref: '/checkout?plan=completo',
      ctaClass: 'btn-landing-lime',
      features: [
        'Tudo do Hub Gestão incluso',
        'Contabilidade completa com contador dedicado',
        'Cálculo e guias automáticas de impostos (DAS)',
        'Declarações obrigatórias (DEFIS, DCTF, etc.)',
        'Abertura de CNPJ ou migração grátis',
        'Planejamento tributário consultivo',
      ],
    },
    {
      name: 'Holding & Patrimonial',
      desc: 'Estruturação e gestão patrimonial para famílias e administradoras de bens.',
      price: 'R$ 890',
      period: '/mês',
      featured: false,
      ctaText: 'Contratar Holding',
      ctaHref: '/checkout?plan=holding',
      ctaClass: 'btn-landing-dark',
      features: [
        'Gestão de múltiplos imóveis e aluguéis',
        'Contabilidade societária especializada',
        'Proteção patrimonial e sucessória',
        'Relatórios consolidados de rendimentos',
        'Atendimento prioritário com especialista',
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
                <h3 className="landing-serif">{plan.name}</h3>
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
