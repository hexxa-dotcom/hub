'use client';

import { useEffect, useRef, useState } from 'react';

export function CalculatorBand() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState({ hours: 0, tax: 0, tools: 0, sheets: 0 });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 1500;
          const startTime = performance.now();

          const animate = (time: number) => {
            const progress = Math.min((time - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setCounts({
              hours: Math.round(12 * easeOut),
              tax: Math.round(100 * easeOut),
              tools: Math.round(5 * easeOut),
              sheets: 0,
            });

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section className="calc-band" ref={containerRef}>
      <div className="landing-wrap">
        <div className="calc-head reveal in">
          <h2 className="landing-serif">O que você faria com tempo de sobra?</h2>
          <p>Simplificar é multiplicar. Quem usa o Hub libera horas perdidas em burocracia toda semana.</p>
        </div>
        <div className="calc-card reveal in">
          <div className="calc-copy">
            <h3 className="landing-serif">Descubra quanto a burocracia custa pra você</h3>
            <p>
              Se tempo é dinheiro, cada segundo conta. Fale com a gente e receba um <b>diagnóstico gratuito</b> da rotina financeira e fiscal da sua empresa.
            </p>
            <a href="#contato" className="btn-landing btn-landing-lime">
              Quero meu diagnóstico
            </a>
          </div>
          <div className="calc-art">
            <div className="count-grid">
              <div className="count-card">
                <b className="landing-serif">{counts.hours}</b>
                <span>horas/mês de volta</span>
              </div>
              <div className="count-card">
                <b className="landing-serif">{counts.tax}%</b>
                <span>dos impostos no prazo</span>
              </div>
              <div className="count-card">
                <b className="landing-serif">{counts.tools}</b>
                <span>ferramentas em 1 hub</span>
              </div>
              <div className="count-card">
                <b className="landing-serif">{counts.sheets}</b>
                <span>planilhas necessárias</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
