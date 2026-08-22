export function SupportSection() {
  const items = [
    {
      title: 'Multicanal, pra todo gosto',
      desc: 'WhatsApp, e-mail ou chamada de vídeo. Você escolhe como prefere resolver.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 12a8 8 0 10-3 6.2L21 19l-.8-2.8A8 8 0 0021 12z" />
        </svg>
      ),
    },
    {
      title: 'Gente de verdade o tempo todo',
      desc: 'Tem coisa que só o calor humano resolve. Fale com nosso time sempre que precisar.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      ),
    },
    {
      title: 'Cliente em primeiro lugar',
      desc: 'Contabilidade nichada significa menos clientes por contador — e mais atenção pra você.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 21s-7-4.5-7-10a7 7 0 0114 0c0 5.5-7 10-7 10z" />
          <path d="M9.5 11l2 2 3.5-3.5" />
        </svg>
      ),
    },
    {
      title: 'Precisa daquela ajuda a mais?',
      desc: 'Consultoria dedicada para o momento da sua empresa: abrir, migrar ou crescer.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="support">
      <div className="landing-wrap">
        <div className="support-head reveal in">
          <span className="pre">Atendimento de verdade</span>
          <h2 className="landing-serif">Bateu a dúvida? Fala com a gente.</h2>
          <p>Nada de robô que não resolve. Você fala direto com quem entende da sua empresa.</p>
        </div>
        <div className="sup-grid">
          {items.map((item, i) => (
            <div key={i} className={`sup-card reveal in ${i > 0 ? `reveal-d${i}` : ''}`}>
              <div className="ic">{item.icon}</div>
              <h3 className="landing-serif">{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
