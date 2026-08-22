export function BentoGrid() {
  return (
    <section className="bento-sec">
      <div className="landing-wrap">
        <div className="bento-head reveal in">
          <h2 className="landing-serif">É o fim da bagunça na gestão. Mesmo.</h2>
          <p>
            Contabilidade, finanças e burocracia resolvidas — e tempo de sobra pra você fazer o que só você faz.
          </p>
        </div>
        <div className="bento reveal in">
          <div className="bcard bc-beige">
            <svg className="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
            </svg>
            <h3 className="landing-serif">Dados &amp; Inteligência</h3>
            <p>Entenda sua empresa sem interpretar linhas e colunas ou abrir várias abas.</p>
          </div>

          <div className="bcard bc-blue">
            <div className="mini">
              <span>Contrato #0348</span>
              <div className="val landing-serif">Assinado ✓</div>
            </div>
            <h3 className="landing-serif">Contratos por finalidade</h3>
            <p>Modelos para projeto fechado, mensalidade recorrente ou hora técnica. Escolha e envie.</p>
          </div>

          <div className="bcard bc-lime">
            <svg className="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 7h8M8 11h5M8 15h6" />
            </svg>
            <h3 className="landing-serif">Impostos no automático</h3>
            <p>O Hub calcula, gera a guia e avisa o vencimento. Você só confirma o pagamento.</p>
          </div>

          <div className="bcard bc-olive">
            <div className="mini">
              <span>Nota fiscal</span>
              <div className="val landing-serif">Emitida</div>
            </div>
            <h3 className="landing-serif">Monitoramento em tempo real</h3>
            <p>Acompanhe tudo pelo celular ou desktop. Como fizer mais sentido pra você.</p>
          </div>

          <div className="bcard bc-cream">
            <svg className="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 17l5-6 4 4 6-8" />
              <path d="M3 21h18" />
            </svg>
            <h3 className="landing-serif">Controle por cliente e projeto</h3>
            <p>Saiba exatamente quanto cada cliente rende — e quanto custa — automaticamente.</p>
          </div>

          <div className="bcard bc-green">
            <svg className="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h3 className="landing-serif">Contabilidade de verdade</h3>
            <p>Por trás da tecnologia, o time da Hexx: contadores nichados em empresas de serviço.</p>
          </div>
        </div>
        <div className="bento-cta reveal in">
          <a href="#planos" className="btn-landing btn-landing-lime">
            Quero o Hub na minha empresa
          </a>
        </div>
      </div>
    </section>
  );
}
