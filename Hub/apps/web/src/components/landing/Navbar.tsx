'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Enquanto DEV_SKIP_AUTH estiver ativo (testes locais, sem Clerk), os botões
// "Entrar" pulam a tela de login e vão direto pras páginas — reverte sozinho
// quando NEXT_PUBLIC_DEV_SKIP_AUTH voltar pra "false".
const DEV_SKIP_AUTH = process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === 'true';
const LOGIN_CLIENTE_HREF = DEV_SKIP_AUTH ? '/cliente' : '/auth/login';
const LOGIN_CONTADOR_HREF = DEV_SKIP_AUTH ? '/contador' : '/auth/login?redirect_url=%2Fcontador';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [entrarOpen, setEntrarOpen] = useState(false);
  const entrarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!entrarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (entrarRef.current && !entrarRef.current.contains(e.target as Node)) {
        setEntrarOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEntrarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [entrarOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header className={`landing-header on-dark ${scrolled ? 'scrolled' : ''}`} id="nav">
        <div className="landing-wrap">
          <Link className="landing-logo" href="/">
            <span className="logo-flex">
              <b className="logo-main">hexx</b>
              <span className="logo-tag-hub">HUB</span>
            </span>
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
            <div className="entrar-dropdown" ref={entrarRef}>
              <button
                type="button"
                className="entrar"
                aria-haspopup="true"
                aria-expanded={entrarOpen}
                onClick={() => setEntrarOpen((v) => !v)}
              >
                Entrar
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`entrar-chevron ${entrarOpen ? 'open' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className={`entrar-menu ${entrarOpen ? 'open' : ''}`} role="menu">
                <Link href={LOGIN_CLIENTE_HREF as any} role="menuitem" onClick={() => setEntrarOpen(false)}>
                  <span className="entrar-menu-title">Entrar como Cliente</span>
                  <span className="entrar-menu-sub">Acessar o painel da minha empresa</span>
                </Link>
                <Link href={LOGIN_CONTADOR_HREF as any} role="menuitem" onClick={() => setEntrarOpen(false)}>
                  <span className="entrar-menu-title">Entrar como Contador</span>
                  <span className="entrar-menu-sub">Acessar a área do contador</span>
                </Link>
              </div>
            </div>
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

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-head">
          <Link className="landing-logo" href="/" onClick={closeMobile} style={{ color: 'var(--cream)' }}>
            <span className="logo-flex">
              <b className="logo-main">hexx</b>
              <span className="logo-tag-hub">HUB</span>
            </span>
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
          <Link href={LOGIN_CLIENTE_HREF as any} className="btn-landing btn-landing-white" onClick={closeMobile} style={{ width: '100%', justifyContent: 'center' }}>
            Entrar como Cliente
          </Link>
          <Link href={LOGIN_CONTADOR_HREF as any} className="btn-landing btn-landing-white" onClick={closeMobile} style={{ width: '100%', justifyContent: 'center' }}>
            Entrar como Contador
          </Link>
          <a href="#contato" className="btn-landing btn-landing-lime" onClick={closeMobile} style={{ width: '100%', justifyContent: 'center' }}>
            Falar com a Hexx
          </a>
        </div>
      </div>
    </>
  );
}
