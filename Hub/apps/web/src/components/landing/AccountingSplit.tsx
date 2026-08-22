export function AccountingSplit() {
  return (
    <>
      {/* Integrations Cloud */}
      <section className="integr" id="contabilidade">
        <div className="landing-wrap">
          <h2 className="landing-serif reveal in">Contabilidade é só o começo.</h2>
          <p className="reveal in reveal-d1">
            A Hexx cuida dos seus impostos como toda contabilidade deveria. E entrega o que <b>nenhuma outra entrega</b>: a operação inteira da sua empresa em um só hub.
          </p>
          <div className="pill-cloud reveal in reveal-d2">
            <span className="pill hl">Contabilidade completa</span>
            <span className="pill">Gestão financeira</span>
            <span className="pill hl">Contratos</span>
            <span className="pill">Assinatura digital</span>
            <span className="pill hl">Impostos automáticos</span>
            <span className="pill">Emissão de notas</span>
            <span className="pill">Relatórios mensais</span>
            <span className="pill hl">Atendimento humano</span>
            <span className="pill">E muito mais</span>
          </div>
          <a href="#planos" className="btn-landing btn-landing-lime reveal in reveal-d3">
            Começar agora
          </a>
        </div>
      </section>

      {/* Lime Split Section */}
      <section className="lime-split">
        <div className="lime-copy reveal in">
          <h2 className="landing-serif">É de mais que um contador que você precisa? A gente tem.</h2>
          <p>
            Contador, a gente é — nichado em empresas de serviço. Mas o que você recebe é um parceiro de negócio: tecnologia, rotina organizada e alguém que responde quando você chama.
          </p>
          <div className="chips">
            <span className="chip">Abertura de CNPJ grátis</span>
            <span className="chip">Enquadramento certo</span>
            <span className="chip">Migração sem burocracia</span>
          </div>
          <a href="#contato" className="link-arrow-landing">
            Conheça a contabilidade Hexx{' '}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="lime-art">
          <div className="badge-card reveal in reveal-d1">
            <svg className="glyph" viewBox="0 0 100 100" fill="currentColor">
              <rect x="2" y="2" width="30" height="30" rx="6" />
              <rect x="68" y="2" width="30" height="30" rx="6" />
              <rect x="35" y="35" width="30" height="30" rx="6" />
              <rect x="2" y="68" width="30" height="30" rx="6" />
              <rect x="68" y="68" width="30" height="30" rx="10" />
            </svg>
            <h3 className="landing-serif">Feito para quem faz tudo sozinho</h3>
            <p>
              Autônomos e empresas de serviço sem funcionários. A gente conhece a sua rotina porque trabalha só com ela.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
