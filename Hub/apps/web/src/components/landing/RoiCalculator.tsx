'use client';

import { useState } from 'react';

const niches = [
  { name: 'Consultoria / Assessoria', baseHours: 12, taxRate: 6 },
  { name: 'Tecnologia / Software / Dev', baseHours: 15, taxRate: 6 },
  { name: 'Design / Criativo / Agência', baseHours: 14, taxRate: 6 },
  { name: 'Saúde / Clínicas / Terapia', baseHours: 10, taxRate: 6 },
  { name: 'Advocacia / Jurídico', baseHours: 13, taxRate: 4.5 },
  { name: 'Outros Serviços', baseHours: 12, taxRate: 6 },
];

export function RoiCalculator() {
  const [revenue, setRevenue] = useState(25000);
  const [selectedNiche, setSelectedNiche] = useState(niches[0]);

  // Hours saved estimate based on revenue volume + niche
  const hoursSaved = Math.round((selectedNiche?.baseHours ?? 12) + (revenue / 25000) * 3);

  // Tools replaced estimate (separate e-signature, invoicing tool, cashflow tool, document storage)
  const softwareSaved = 290;

  return (
    <section className="calculator-sec" id="calculadora">
      <div className="landing-wrap">
        <div className="calc-container">
          <div className="calc-interactive reveal in">
            <span className="hero-eyebrow">Simulador de Autonomia</span>
            <h2 className="landing-serif" style={{ fontSize: '32px', marginBottom: '24px', lineHeight: 1.2 }}>
              Quanto tempo e dinheiro você economiza com o Hexx Hub?
            </h2>

            <div className="calc-group">
              <div className="calc-label">
                <span>Faturamento Mensal Estimado</span>
                <b>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
                    revenue
                  )}
                  /mês
                </b>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="5000"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value))}
                className="calc-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontWeight: 600 }}>
                <span>R$ 5.000</span>
                <span>R$ 50.000</span>
                <span>R$ 100.000+</span>
              </div>
            </div>

            <div className="calc-group">
              <div className="calc-label" style={{ marginBottom: '10px' }}>
                <span>Sua Área de Atuação</span>
              </div>
              <div className="calc-niche-chips">
                {niches.map((niche, i) => (
                  <button
                    key={i}
                    className={`niche-chip ${selectedNiche?.name === niche.name ? 'active' : ''}`}
                    onClick={() => setSelectedNiche(niche)}
                  >
                    {niche.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="calc-results reveal in reveal-d1">
            <div>
              <span className="mock-pill">Diagnóstico em Tempo Real</span>
              <h3 className="landing-serif" style={{ fontSize: '28px', marginTop: '14px', marginBottom: '8px' }}>
                O impacto da autogestão no seu negócio
              </h3>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>
                Substitua 4 ferramentas avulsas e elimine o estresse de conciliação e impostos.
              </p>
            </div>

            <div className="calc-results-grid">
              <div className="calc-stat-box">
                <span className="val">{hoursSaved}h</span>
                <span className="desc">Livres no mês para focar em clientes</span>
              </div>
              <div className="calc-stat-box">
                <span className="val">~R$ {softwareSaved}</span>
                <span className="desc">Economia em softwares avulsos/mês</span>
              </div>
              <div className="calc-stat-box">
                <span className="val">100%</span>
                <span className="desc">Conformidade e guias no prazo</span>
              </div>
              <div className="calc-stat-box">
                <span className="val">1 Hub</span>
                <span className="desc">Tudo em uma única assinatura</span>
              </div>
            </div>

            <div>
              <a href="#planos" className="btn-landing btn-landing-lime" style={{ width: '100%', justifyContent: 'center' }}>
                Garantir Essa Economia →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
