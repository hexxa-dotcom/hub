export function TestimonialsSection() {
  const testimonials = [
    {
      initials: 'RS',
      name: 'Rodrigo Silveira',
      role: 'Consultor de Estratégia & Gestão',
      text: '“Antes do Hub, eu gastava um sábado inteiro por mês cruzando planilhas, emitindo notas e cobrando clientes. Hoje faço tudo no mesmo lugar em minutos. A contabilidade em realtime me dá segurança total.”',
      highlight: 'Economia de 12h/mês',
    },
    {
      initials: 'MC',
      name: 'Mariana Castro',
      role: 'Founder & Designer na Studio Craft',
      text: '“O fluxo de contratos com assinatura digital integrada é surreal. Mando a proposta para o cliente, ele assina pelo celular e a nota já fica engatilhada. É a solução perfeita pra quem toca a empresa sozinho.”',
      highlight: 'Contratos fechados no mesmo dia',
    },
    {
      initials: 'TF',
      name: 'Thiago Fontes',
      role: 'Desenvolvedor & Arquiteto de Software',
      text: '“Troquei três ferramentas pagas (emissor de nota, assinador e app financeiro) pelo Hexx Hub. Além de pagar menos, o suporte da contabilidade é humano e responde rápido quando preciso.”',
      highlight: '3 ferramentas consolidadas em 1',
    },
  ];

  return (
    <section className="testim-sec" id="depoimentos">
      <div className="landing-wrap">
        <div className="testim-head reveal in">
          <span className="hero-eyebrow">Histórias Reais</span>
          <h2 className="landing-serif">Quem toca a própria empresa confia no Hexx Hub</h2>
          <p>
            Profissionais autônomos e empresas de serviços que conquistaram tempo e liberdade com a autogestão.
          </p>
        </div>

        <div className="testim-grid reveal in">
          {testimonials.map((item, i) => (
            <div key={i} className="testim-card">
              <div>
                <div className="testim-stars">
                  {'★★★★★'.split('').map((star, idx) => (
                    <span key={idx} style={{ fontSize: '18px' }}>
                      {star}
                    </span>
                  ))}
                </div>
                <p className="testim-text">{item.text}</p>
              </div>

              <div>
                <div style={{ marginBottom: '12px' }}>
                  <span className="mock-pill">{item.highlight}</span>
                </div>
                <div className="testim-author">
                  <div className="testim-avatar">{item.initials}</div>
                  <div className="testim-meta">
                    <b>{item.name}</b>
                    <span>{item.role}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
