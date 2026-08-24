import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="landing-wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="landing-logo" href="/">
              <span className="logo-flex">
                <b className="logo-main">hexx</b>
                <span className="logo-tag-hub">HUB</span>
              </span>
            </Link>
            <div className="foot-statement landing-serif">
              Clareza pra decidir.
              <br />
              Liberdade pra crescer.
              <br />
              Muito mais que contabilidade.
            </div>
            <div className="foot-social">
              <a href="#" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7.5 0h3.8v2.05h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V23h-4v-7.9c0-1.88-.03-4.3-2.62-4.3-2.62 0-3.02 2.05-3.02 4.16V23H8V8z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.8" cy="6.2" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="#" aria-label="YouTube" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23 7.2s-.22-1.6-.9-2.3c-.86-.92-1.82-.93-2.26-.98C16.7 3.7 12 3.7 12 3.7s-4.7 0-7.84.22c-.44.05-1.4.06-2.26.98-.68.7-.9 2.3-.9 2.3S.77 9.07.77 10.94v1.75c0 1.87.23 3.74.23 3.74s.22 1.6.9 2.3c.86.92 2 .89 2.5 1 1.82.17 7.6.22 7.6.22s4.7-.01 7.84-.23c.44-.05 1.4-.06 2.26-.98.68-.7.9-2.3.9-2.3s.23-1.87.23-3.74v-1.75c0-1.87-.23-3.74-.23-3.74zM9.55 15.13V8.6l6.08 3.28-6.08 3.26z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="foot-col">
            <h4 className="landing-serif">Navegação</h4>
            <Link href="/recursos">O Hub por Dentro</Link>
            <small>Módulos, emissão de NFSe e DRE</small>
            <Link href="/simulador">Simulador de Economia</Link>
            <small>Diagnóstico interativo e ROI</small>
            <Link href="/planos">Planos e Preços</Link>
            <small>Tabela comparativa de recursos</small>
            <Link href={'/auth/login' as any}>Acesso ao Hub</Link>
            <small>Portal do Cliente e Contador</small>
          </div>

          <div className="foot-col">
            <h4 className="landing-serif">Hexx Digital</h4>
            <a href="/#depoimentos">Depoimentos de Clientes</a>
            <a href="/#faq">Perguntas frequentes</a>
            <a href="/#contato">Fale com a gente</a>
            <a href="mailto:contato@hexxdigital.com.br">contato@hexxdigital.com.br</a>
          </div>
        </div>

        <div className="foot-legal">
          Hexx Digital — Contabilidade consultiva e tecnologia para empresas de serviço e holdings.
          <br />
          Segurança em primeiro lugar. Criptografia de ponta a ponta e integração com o Sefin Nacional.
          <div className="foot-tag">© 2026 Hexx Digital. Todos os direitos reservados.</div>
        </div>
      </div>
    </footer>
  );
}
