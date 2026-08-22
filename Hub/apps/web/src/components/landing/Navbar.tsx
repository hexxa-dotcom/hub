'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type LogoVariant = 'minimal' | 'dot' | 'badge' | 'icon' | 'classic';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [variant, setVariant] = useState<LogoVariant>('minimal');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  const renderLogo = () => {
    switch (variant) {
      case 'minimal':
        // Opção 1A: hexx hub (hub em verde-limão)
        return (
          <span className="logo-flex">
            <b className="logo-main">hexx</b>
            <span className="logo-accent">hub</span>
          </span>
        );
      case 'dot':
        // Opção 1B: hexx.hub (com ponto tech)
        return (
          <span className="logo-flex">
            <b className="logo-main">hexx</b>
            <span className="logo-dot">.</span>
            <span className="logo-subtext">hub</span>
          </span>
        );
      case 'badge':
        // Opção 2: hexx [ HUB ] (marca + badge de produto)
        return (
          <span className="logo-flex">
            <b className="logo-main">hexx</b>
            <span className="logo-tag-hub">HUB</span>
          </span>
        );
      case 'icon':
        // Opção 3: ⬡ hexx hub (ícone geométrico moderno)
        return (
          <span className="logo-flex">
            <svg className="logo-hex-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <b className="logo-main">hexx</b>
            <span className="logo-subtext">hub</span>
          </span>
        );
      case 'classic':
        // Opção 4: hexx digital (original)
        return (
          <span className="logo-flex">
            <b className="logo-main">hexx</b>
            <span className="logo-subtext">digital</span>
          </span>
        );
    }
  };

  return (
    <>
      <header className={`landing-header on-dark ${scrolled ? 'scrolled' : ''}`} id="nav">
        <div className="landing-wrap">
          <Link className="landing-logo" href="/">
            {renderLogo()}
          </Link>

          <nav className="landing-nav-center">
            <a href="#hub-por-dentro">O Hub</a>
            <a href="#calculadora">Simulador</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <a href="#depoimentos">Depoimentos</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="landing-nav-right">
            <Link className="entrar" href={'/sign-in' as any}>
              Entrar
            </Link>
            <a className="btn-landing landing-nav-cta" href="#contato">
              Fale com a Hexx
            </a>
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu de navegação"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Logo Switcher for User Testing */}
      <aside className="logo-switcher-bar" aria-label="Seletor de estilo do logo">
        <div className="switcher-label">Escolha o Logo:</div>
        <div className="switcher-buttons">
          <button
            className={`switch-btn ${variant === 'minimal' ? 'active' : ''}`}
            onClick={() => setVariant('minimal')}
          >
            1. hexx <b>hub</b>
          </button>
          <button
            className={`switch-btn ${variant === 'dot' ? 'active' : ''}`}
            onClick={() => setVariant('dot')}
          >
            2. hexx<b>.</b>hub
          </button>
          <button
            className={`switch-btn ${variant === 'badge' ? 'active' : ''}`}
            onClick={() => setVariant('badge')}
          >
            3. hexx <b>[HUB]</b>
          </button>
          <button
            className={`switch-btn ${variant === 'icon' ? 'active' : ''}`}
            onClick={() => setVariant('icon')}
          >
            4. ⬡ hexx <b>hub</b>
          </button>
          <button
            className={`switch-btn ${variant === 'classic' ? 'active' : ''}`}
            onClick={() => setVariant('classic')}
          >
            5. hexx <b>digital</b>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-head">
          <Link className="landing-logo" href="/" onClick={closeMobile} style={{ color: 'var(--cream)' }}>
            {renderLogo()}
          </Link>
          <button
            onClick={closeMobile}
            style={{ background: 'transparent', border: 'none', color: 'var(--cream)', cursor: 'pointer', padding: '8px' }}
            aria-label="Fechar menu"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mobile-drawer-links">
          <a href="#hub-por-dentro" onClick={closeMobile}>
            O Hub por Dentro
          </a>
          <a href="#calculadora" onClick={closeMobile}>
            Simulador de Autonomia
          </a>
          <a href="#recursos" onClick={closeMobile}>
            Recursos &amp; Módulos
          </a>
          <a href="#planos" onClick={closeMobile}>
            Planos &amp; Valores
          </a>
          <a href="#depoimentos" onClick={closeMobile}>
            Depoimentos
          </a>
          <a href="#faq" onClick={closeMobile}>
            Perguntas Frequentes
          </a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Link href={'/sign-in' as any} className="btn-landing btn-landing-white" onClick={closeMobile} style={{ width: '100%', justifyContent: 'center' }}>
            Acessar Minha Conta (Entrar)
          </Link>
          <a href="#contato" className="btn-landing btn-landing-lime" onClick={closeMobile} style={{ width: '100%', justifyContent: 'center' }}>
            Falar com a Hexx
          </a>
        </div>
      </div>
    </>
  );
}
