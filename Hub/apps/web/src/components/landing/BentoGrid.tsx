export function BentoGrid() {
  return (
    <section className="bento-sec">
      <div className="landing-wrap">
        <div className="bento-head reveal in">
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.025em' }}>É o fim da bagunça na gestão. Mesmo.</h2>
          <p>
            Contabilidade consultiva, finanças em tempo real e automação fiscal — tudo integrado em um único lugar.
          </p>
        </div>
        <div className="bento reveal in">
          <div className="bcard bc-beige">
            <div className="mini">
              <span>Simples Nacional</span>
              <div className="val" style={{ color: '#2F4A3C', fontWeight: 800 }}>6% (Anexo III)</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Termômetro do Fator R</h3>
            <p>Monitoramento contínuo da folha sobre faturamento para garantir a menor alíquota de impostos da sua empresa.</p>
          </div>

          <div className="bcard bc-blue">
            <div className="mini">
              <span>Proposta #0348</span>
              <div className="val">Assinado (DocuSeal) ✓</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Proposta que vira Contrato</h3>
            <p>Envie orçamentos profissionais com aceite e assinatura digital com validade jurídica ICP-Brasil em minutos.</p>
          </div>

          <div className="bcard bc-lime">
            <div className="mini">
              <span>Cobrança Asaas</span>
              <div className="val" style={{ color: '#1E3328', fontWeight: 800 }}>Pix &amp; Boleto</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Cobranças &amp; Baixa Automática</h3>
            <p>Emita links de pagamento vinculados a notas fiscais. O cliente paga e o Hub concilia na hora.</p>
          </div>

          <div className="bcard bc-olive">
            <div className="mini">
              <span>Retirada de Sócios</span>
              <div className="val">100% Isento de IR</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Distribuição de Lucros</h3>
            <p>Controle exato de quanto transferir para a conta PF com recibos legais e total conformidade contábil.</p>
          </div>

          <div className="bcard bc-cream">
            <div className="mini">
              <span>Inteligência Artificial</span>
              <div className="val" style={{ color: '#2F4A3C', fontWeight: 800 }}>Protocolo MCP</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Hub Preparado para IA</h3>
            <p>Conecte agentes de IA ao Hub via protocolo MCP para gerar análises financeiras e projeções com privacidade.</p>
          </div>

          <div className="bcard bc-green">
            <div className="mini">
              <span>Atendimento Direto</span>
              <div className="val" style={{ color: '#DFFFAE', fontWeight: 800 }}>WhatsApp Dedicado</div>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>Contabilidade Consultiva</h3>
            <p>Especialistas em empresas de tecnologia e serviços cuidando de todas as guias e declarações da sua empresa.</p>
          </div>
        </div>
        <div className="bento-cta reveal in">
          <a href="/planos" className="btn-landing btn-landing-lime">
            Experimentar o Hub →
          </a>
        </div>
      </div>
    </section>
  );
}

