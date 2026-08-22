'use client';

import { useState, useEffect } from 'react';

const slideData = [
  {
    tag: 'Gestão financeira completa',
    desc: '<b>Fluxo de caixa, cobranças e conciliação</b> em um painel que qualquer pessoa entende.',
  },
  {
    tag: 'Contratos em minutos',
    desc: '<b>Crie e envie contratos profissionais</b> a partir de modelos prontos para serviços.',
  },
  {
    tag: 'Assinatura digital',
    desc: '<b>Feche negócios sem imprimir nada</b>, com assinaturas de validade jurídica.',
  },
  {
    tag: 'Impostos automáticos',
    desc: '<b>O Hub calcula seus impostos sozinho</b> e avisa quanto e quando pagar.',
  },
  {
    tag: 'Relatórios e indicadores',
    desc: '<b>Veja quanto sua empresa realmente lucra</b>, mês a mês, sem contabilês.',
  },
];

export function CarouselSection() {
  const [current, setCurrent] = useState(0);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slideData.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slideData.length) % slideData.length);

  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="carousel-sec" id="hub">
      <div className="landing-wrap">
        <div className="car-grid">
          <div className="reveal in">
            <h2 className="landing-serif">
              Mais empresa,
              <br />
              menos burocracia.
            </h2>
            <div className="car-tag">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
              </svg>
              <span>{slideData[current]?.tag ?? ''}</span>
            </div>
            <p
              className="car-desc"
              dangerouslySetInnerHTML={{ __html: slideData[current]?.desc ?? '' }}
            />
            <a href="#contato" className="btn-landing btn-landing-green">
              Saiba mais
            </a>
            <div className="car-dots">
              {slideData.map((_, i) => (
                <button
                  key={i}
                  className={`car-dot ${i === current ? 'active' : ''}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="car-visual">
            {/* Slide 1 · Finanças */}
            <div className={`car-slide ${current === 0 ? 'active' : ''}`}>
              <div className="mock" style={{ width: '400px' }}>
                <div className="mock-head">
                  <span className="mock-dot"></span> Visão geral · Julho
                </div>
                <div className="mock-big landing-serif">R$ 24.380,00</div>
                <div className="mock-row">
                  <span>Projeto — Identidade visual</span>
                  <span className="pos">+ R$ 6.500</span>
                </div>
                <div className="mock-row">
                  <span>Consultoria mensal</span>
                  <span className="pos">+ R$ 3.900</span>
                </div>
                <div className="mock-row">
                  <span>Software e ferramentas</span>
                  <span className="neg">− R$ 420</span>
                </div>
                <div className="mock-foot">Atualizado agora · conciliação automática</div>
              </div>
              <div className="mock-float" style={{ top: '8%', right: '2%' }}>
                <span className="mock-pill">Recebido</span>
                <div style={{ fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>Pix · R$ 2.300,00</div>
              </div>
            </div>

            {/* Slide 2 · Contratos */}
            <div className={`car-slide ${current === 1 ? 'active' : ''}`}>
              <div className="mock" style={{ width: '380px' }}>
                <div className="mock-head">
                  <span className="mock-dot"></span> Contrato de prestação de serviço
                </div>
                <div style={{ padding: '20px 18px 6px' }}>
                  <div className="landing-serif" style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
                    Proposta #0347 — aceita
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.6 }}>
                    Escopo, prazos e condições gerados a partir de um modelo validado juridicamente.
                  </div>
                </div>
                <div className="mock-row" style={{ borderTop: '1px solid rgba(35,31,32,.05)', marginTop: '14px' }}>
                  <span>Status</span>
                  <span className="mock-pill">Enviado ao cliente</span>
                </div>
                <div className="mock-foot">Modelos prontos para serviços</div>
              </div>
              <div className="mock-float" style={{ bottom: '10%', right: '0' }}>
                <span className="mock-pill gray">Cliente</span>
                <div style={{ fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>Abriu o contrato há 2 min</div>
              </div>
            </div>

            {/* Slide 3 · Assinatura */}
            <div className={`car-slide ${current === 2 ? 'active' : ''}`}>
              <div className="mock" style={{ width: '380px', textAlign: 'center', paddingBottom: '8px' }}>
                <div className="mock-head" style={{ justifyContent: 'center' }}>
                  <span className="mock-dot"></span> Assinatura digital
                </div>
                <div style={{ padding: '34px 30px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div className="sigline landing-serif">Ana C. Ribeiro</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>
                    Assinado digitalmente · validade jurídica
                  </div>
                </div>
                <div className="mock-row">
                  <span>Você</span>
                  <span className="mock-pill">Assinado</span>
                </div>
                <div className="mock-row">
                  <span>Cliente</span>
                  <span className="mock-pill">Assinado</span>
                </div>
                <div className="mock-foot">Fechado sem imprimir uma folha</div>
              </div>
            </div>

            {/* Slide 4 · Impostos */}
            <div className={`car-slide ${current === 3 ? 'active' : ''}`}>
              <div className="mock" style={{ width: '380px' }}>
                <div className="mock-head">
                  <span className="mock-dot"></span> Impostos · calculados sozinhos
                </div>
                <div className="mock-big landing-serif">DAS · R$ 412,30</div>
                <div className="mock-row">
                  <span>Mês de referência</span>
                  <span>Julho/2026</span>
                </div>
                <div className="mock-row">
                  <span>Vencimento</span>
                  <span style={{ fontWeight: 800 }}>20/08</span>
                </div>
                <div className="mock-row">
                  <span>Guia</span>
                  <span className="mock-pill">Gerada</span>
                </div>
                <div className="mock-foot">Você recebe o aviso. A guia chega pronta.</div>
              </div>
              <div className="mock-float" style={{ top: '6%', right: '4%' }}>
                <span className="mock-pill">Sem susto</span>
                <div style={{ fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>Nada em atraso ✓</div>
              </div>
            </div>

            {/* Slide 5 · Relatórios */}
            <div className={`car-slide ${current === 4 ? 'active' : ''}`}>
              <div className="mock" style={{ width: '400px' }}>
                <div className="mock-head">
                  <span className="mock-dot"></span> Seu mês em números
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', padding: '30px 24px 10px', height: '170px' }}>
                  <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '40%' }}></div>
                  <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '62%' }}></div>
                  <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '50%' }}></div>
                  <div style={{ flex: 1, background: 'var(--lime)', borderRadius: '8px 8px 0 0', height: '88%' }}></div>
                </div>
                <div className="mock-row">
                  <span>Lucro real do mês</span>
                  <span className="pos">R$ 11.240</span>
                </div>
                <div className="mock-foot">Sem contabilês. Só o que importa.</div>
              </div>
            </div>

            <div className="car-nav">
              <button className="car-btn" onClick={prevSlide} aria-label="Anterior">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button className="car-btn solid" onClick={nextSlide} aria-label="Próximo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
