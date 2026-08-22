export function MediaSplit() {
  return (
    <section className="media-split">
      <div className="landing-wrap">
        <div className="media-card reveal in">
          <div className="media-copy">
            <h2 className="landing-serif">Elimine a papelada da sua rotina</h2>
            <p>
              Notas, contratos, guias e comprovantes anexados a cada movimentação. Menos operação manual, mais eficiência.
            </p>
            <a href="#contato" className="btn-landing btn-landing-dark">
              Fale com a Hexx
            </a>
          </div>
          <div className="media-art">
            <div className="paper" style={{ top: '12%', left: '8%', width: '120px' }}>
              <span>NOTA FISCAL</span>
              <div className="lines">
                <i style={{ width: '80%' }}></i>
                <i style={{ width: '60%' }}></i>
                <i style={{ width: '70%' }}></i>
              </div>
            </div>
            <div className="paper" style={{ top: '60%', left: '4%', width: '110px', animationDelay: '1.4s' }}>
              <span>DAS · GUIA</span>
              <div className="lines">
                <i style={{ width: '70%' }}></i>
                <i style={{ width: '50%' }}></i>
              </div>
            </div>
            <div className="paper" style={{ top: '20%', right: '6%', width: '126px', animationDelay: '0.8s' }}>
              <span>CONTRATO</span>
              <div className="lines">
                <i style={{ width: '85%' }}></i>
                <i style={{ width: '65%' }}></i>
                <i style={{ width: '75%' }}></i>
              </div>
            </div>
            <div className="paper" style={{ bottom: '10%', right: '10%', width: '110px', animationDelay: '2s' }}>
              <span>RECIBO</span>
              <div className="lines">
                <i style={{ width: '60%' }}></i>
                <i style={{ width: '75%' }}></i>
              </div>
            </div>
            <div className="phone">
              <div className="p-head">Hexx Hub</div>
              <div className="p-card">
                Comprovação de despesa <b className="p-ok">Realizada ✓</b>
              </div>
              <div className="p-card">
                Contrato anexado <b>Projeto #0347</b>
              </div>
              <div className="p-card">
                Guia de imposto <b className="p-ok">Paga ✓</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
