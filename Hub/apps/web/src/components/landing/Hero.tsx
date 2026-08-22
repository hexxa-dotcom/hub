'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function Hero() {
  const [barWidth, setBarWidth] = useState('0%');

  useEffect(() => {
    const timer = setTimeout(() => {
      setBarWidth('72%');
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="landing-hero">
      <div className="landing-wrap hero-inner">
        <span className="hero-eyebrow reveal in">
          Exclusivo para Empresas de Serviços e Autônomos
        </span>
        <h1 className="landing-serif hero-title reveal in">
          O hub completo para você <em>autogerenciar</em> a sua empresa.
        </h1>
        <p className="hero-sub reveal in reveal-d1">
          Contabilidade em tempo real, gestão financeira, contratos digitais e emissão de notas. Tudo o que você precisa em um único lugar, sem malabarismo de planilhas.
        </p>
        <div className="flex flex-wrap items-center gap-4 reveal in reveal-d2">
          <a href="#hub-por-dentro" className="btn-landing btn-landing-lime">
            Conheça o Hub por Dentro
          </a>
          <a href="#calculadora" className="btn-landing btn-landing-dark">
            Simular Minha Economia
          </a>
        </div>
      </div>

      <div className="hero-chips">
        <div className="chip-card chip-main">
          <div className="chip-bar">
            <i style={{ width: barWidth }}></i>
          </div>
          <div className="chip-vals">
            <span>R$ 24.800 (Faturado)</span>
            <span>100% Conciliado</span>
          </div>
        </div>
        <div className="chip-card sq">
          <svg viewBox="0 0 24 24" fill="none" stroke="#DFFFAE" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
          </svg>
        </div>
        <div className="chip-card sq">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FEFDF3" strokeWidth="1.6" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="12" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
      </div>

      <div className="hero-scroll">Role</div>
    </section>
  );
}
