export function SegmentsMarquee() {
  const segments = [
    'Consultorias',
    'Design & Criativo',
    'Tecnologia',
    'Saúde & Bem-estar',
    'Advocacia',
    'Arquitetura',
    'Educação',
    'Marketing',
  ];

  return (
    <div className="landing-wrap">
      <div className="strip reveal in">
        <h2 className="landing-serif">Feito para todo tipo de empresa de serviço</h2>
        <div className="marquee">
          <div className="marquee-track">
            {segments.map((seg, i) => (
              <span key={i} className="mq-item landing-serif">
                {seg}
              </span>
            ))}
          </div>
          <div className="marquee-track" aria-hidden="true">
            {segments.map((seg, i) => (
              <span key={`dup-${i}`} className="mq-item landing-serif">
                {seg}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
