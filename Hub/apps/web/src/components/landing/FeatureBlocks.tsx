export function FeatureBlocks() {
  return (
    <section className="features" id="recursos">
      <div className="landing-wrap">
        {/* Block 1: Financeiro */}
        <div className="feat-block">
          <div className="feat-card reveal in">
            <span className="tag-lime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
              </svg>
              Organização financeira
            </span>
            <h2 className="landing-serif">Configure a estrutura da sua empresa em poucos cliques</h2>
            <p>
              Cada entrada e saída já aparece categorizada por cliente, projeto e tipo de despesa. Sem planilha, sem retrabalho.
            </p>
            <div className="chips">
              <span className="chip">Fluxo de caixa em tempo real</span>
              <span className="chip">Categorização automática</span>
              <span className="chip">Cobranças e recebimentos</span>
            </div>
          </div>
          <div className="feat-visual reveal in reveal-d1">
            <div className="mock" style={{ width: '380px' }}>
              <div className="mock-head">
                <span className="mock-dot"></span> Categorias · Julho
              </div>
              <div className="mock-row">
                <span>Serviços prestados</span>
                <span className="pos">+ R$ 18.400</span>
              </div>
              <div className="mock-row">
                <span>Ferramentas</span>
                <span className="neg">− R$ 640</span>
              </div>
              <div className="mock-row">
                <span>Pró-labore</span>
                <span className="neg">− R$ 5.000</span>
              </div>
              <div className="mock-row">
                <span>Impostos</span>
                <span className="neg">− R$ 412</span>
              </div>
              <div className="mock-foot">Conciliado com seu banco automaticamente</div>
            </div>
            <div className="mock-float" style={{ top: '4%', right: '6%' }}>
              <span className="mock-pill">Entrada</span>
              <div style={{ fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>
                R$ 12.000,00 · categorizado
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: Contratos & Assinatura */}
        <div className="feat-block rev">
          <div className="feat-card reveal in">
            <span className="tag-lime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
              </svg>
              Contratos &amp; assinatura
            </span>
            <h2 className="landing-serif">Feche negócios em minutos, não em semanas</h2>
            <p>
              Gere contratos profissionais a partir de modelos prontos, envie para o cliente e receba a assinatura digital no mesmo dia.
            </p>
            <div className="chips">
              <span className="chip">Modelos validados</span>
              <span className="chip">Assinatura com validade jurídica</span>
              <span className="chip">Acompanhamento em tempo real</span>
              <span className="chip">Tudo arquivado no Hub</span>
            </div>
          </div>
          <div className="feat-visual reveal in reveal-d1">
            <div className="mock" style={{ width: '360px', textAlign: 'center' }}>
              <div className="mock-head" style={{ justifyContent: 'center' }}>
                <span className="mock-dot"></span> Contrato #0347
              </div>
              <div style={{ padding: '30px 28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div className="sigline landing-serif">F. Heck</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>
                  Assinado em 19/07 · 14:32
                </div>
              </div>
              <div className="mock-row">
                <span>Valor do projeto</span>
                <span style={{ fontWeight: 800 }}>R$ 8.900,00</span>
              </div>
              <div className="mock-row">
                <span>Status</span>
                <span className="mock-pill">Concluído</span>
              </div>
              <div className="mock-foot">Enviado, assinado e arquivado</div>
            </div>
            <div className="mock-float" style={{ bottom: '8%', left: '2%' }}>
              <span className="mock-pill gray">Notificação</span>
              <div style={{ fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>Cliente assinou 🎉</div>
            </div>
          </div>
        </div>

        {/* Block 3: Inteligência fiscal */}
        <div className="feat-block">
          <div className="feat-card reveal in">
            <span className="tag-lime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
              </svg>
              Inteligência fiscal
            </span>
            <h2 className="landing-serif">Tome decisões baseadas em dados, não em achismo</h2>
            <p>
              Impostos calculados automaticamente, lucro real na tela e relatórios que mostram para onde sua empresa está indo.
            </p>
            <div className="chips">
              <span className="chip">Cálculo automático de impostos</span>
              <span className="chip">Guias geradas e avisadas</span>
              <span className="chip">Relatórios sem contabilês</span>
            </div>
          </div>
          <div className="feat-visual reveal in reveal-d1">
            <div className="mock" style={{ width: '390px' }}>
              <div className="mock-head">
                <span className="mock-dot"></span> Raio-x do mês
              </div>
              <div className="mock-big landing-serif">Lucro real · R$ 11.240</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '6px 24px 14px', height: '130px' }}>
                <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '38%' }}></div>
                <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '58%' }}></div>
                <div style={{ flex: 1, background: 'var(--beige)', borderRadius: '8px 8px 0 0', height: '46%' }}></div>
                <div style={{ flex: 1, background: 'var(--lime)', borderRadius: '8px 8px 0 0', height: '84%' }}></div>
              </div>
              <div className="mock-row">
                <span>Imposto do mês</span>
                <span className="mock-pill">Guia pronta</span>
              </div>
              <div className="mock-foot">Zero susto no dia 20</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
