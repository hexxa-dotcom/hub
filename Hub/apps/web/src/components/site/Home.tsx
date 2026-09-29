import { Saldo, Produto, Planos, Perguntas, Contato, Rotulo } from './HomeInterativo';

const cor = { g: '#0E0E10', g2: '#1C1C20', g3: '#2A2A2E', p: '#F3F2EE', s: '#B9E86B', c1: '#E1E0DA', c2: '#C9C8C2', c4: '#B8B8B4', c5: '#8A8A86', c6: '#5A5A56', c7: '#3A3A38' };
const grade = (n: number, gap: number | string = 20) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${n}px),1fr))`, gap });

// ── Dados ilustrativos do painel (PENDENTE no handoff: confirmar se ficam) ──
const LANCAMENTOS = [
  ['Contrato mensal · Cliente Prime', 'Hoje · Pix', '+ R$ 14.500,00', cor.p],
  ['Cobrança Pix liquidada', 'Ontem · Boleto', '+ R$ 6.800,00', cor.p],
  ['Servidores e ferramentas SaaS', '28/09 · Cartão', '− R$ 840,00', cor.c4],
];
const SEGMENTOS = ['Consultorias', 'Design & criativo', 'Tecnologia', 'Saúde & bem-estar', 'Advocacia', 'Arquitetura', 'Educação', 'Marketing'];
const RECURSOS = [
  ['Simples Nacional', '6% · Anexo III', 'Termômetro do Fator R', 'Monitoramento contínuo da folha sobre o faturamento para garantir a menor alíquota.'],
  ['Proposta #0348', 'Assinada ✓', 'Proposta que vira contrato', 'Orçamentos com aceite e assinatura digital com validade jurídica ICP-Brasil em minutos.'],
  ['Cobrança', 'Pix & boleto', 'Baixa automática', 'Links de pagamento vinculados à nota fiscal. O cliente paga e a Hexx concilia na hora.'],
  ['Retirada de sócios', 'Isento de IR', 'Distribuição de lucros', 'Quanto transferir para a conta PF, com recibos legais e conformidade contábil.'],
  ['Inteligência artificial', 'Protocolo MCP', 'Pronta para IA', 'Conecte agentes de IA à Hexx para gerar análises e projeções financeiras com privacidade.'],
  ['Atendimento', 'WhatsApp', 'Contabilidade consultiva', 'Especialistas em empresas de serviço cuidando de todas as guias e declarações.'],
];

/**
 * "Como fica na prática": situações típicas, SEM nome de pessoa e marcadas
 * como exemplo. Depoimento com nome só entra quando for de cliente real,
 * com autorização — o protótipo trazia depoimentos inventados.
 */
const NA_PRATICA: [string, string, string][] = [
  ['Consultoria', 'Horas de planilha por mês', 'Nota, cobrança e conciliação no mesmo lugar: o fechamento do mês deixa de tomar um sábado inteiro.'],
  ['Design e criativo', 'Proposta aceita no mesmo dia', 'A proposta vira contrato assinado pelo celular, e a nota já fica pronta para sair quando o serviço é entregue.'],
  ['Tecnologia', 'Menos ferramentas avulsas', 'Emissor de nota, assinatura de contratos e controle financeiro dentro da Hexx, com a contabilidade junto.'],
];
const ATENDIMENTO = [
  ['Multicanal', 'WhatsApp, e-mail ou chamada de vídeo. Você escolhe como prefere resolver.'],
  ['Gente de verdade', 'Tem coisa que só conversa resolve. Fale com o time sempre que precisar.'],
  ['Menos clientes por contador', 'Contabilidade nichada significa mais atenção para a sua empresa.'],
  ['Consultoria dedicada', 'Para o momento da sua empresa: abrir, migrar ou crescer.'],
];

function Hero() {
  return (
    <section id="topo" style={{ position: 'relative', overflow: 'hidden', background: cor.g, color: cor.p }}>
      <img loading="eager" src="/brand/hexx-simbolo-branco.svg" alt="" style={{ position: 'absolute', right: -160, top: -40, height: 780, width: 'auto', opacity: 0.06, pointerEvents: 'none' }} />
      <div className="wrap" style={{ position: 'relative', paddingTop: 96, paddingBottom: 88, ...grade(460, 64), alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Rotulo c={cor.c4}>Para empresas de serviço, agências, devs e consultorias</Rotulo>
          <h1 style={{ margin: 0, fontSize: 'clamp(44px,6vw,80px)', fontWeight: 600, letterSpacing: '-.055em', lineHeight: 0.98, textWrap: 'balance' }}>
            Contabilidade e gestão financeira. <span style={{ color: cor.s }}>Sem burocracia.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.55, color: cor.c4, maxWidth: 520, textWrap: 'pretty' }}>
            Emita notas em segundos, saiba seu lucro real e tenha um contador dedicado cuidando dos seus impostos direto pelo WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="#planos" className="btn-s" style={{ fontSize: 15, padding: '16px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>Experimentar a Hexx <span>→</span></a>
            <a href="#contato" className="btn-o" style={{ fontSize: 15, padding: '16px 24px' }}>Falar com um contador</a>
          </div>
        </div>
        <div data-stagger="1" style={{ background: cor.g2, border: `1px solid ${cor.g3}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: `1px solid ${cor.g3}`, gap: 12, flexWrap: 'wrap' }}>
            <div className="m" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c5 }}>Saldo disponível · Conta PJ</div>
            <div className="m" style={{ fontSize: 11, color: cor.s, display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 6, height: 6, background: cor.s, borderRadius: '50%' }} />Conciliação automática</div>
          </div>
          <div style={{ padding: '26px 22px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="m" style={{ fontSize: 'clamp(34px,4vw,48px)', fontWeight: 500, letterSpacing: '-.03em' }}><Saldo /></div>
            <div style={{ fontSize: 13, color: cor.c5 }}>Faturado no mês <span className="m" style={{ color: cor.p }}>R$ 38.900</span> · 100% conciliado</div>
          </div>
          {LANCAMENTOS.map(([rot, tag, val, c]) => (
            <div key={rot} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 22px', borderTop: `1px solid ${cor.g3}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><div style={{ fontSize: 14 }}>{rot}</div><div className="m" style={{ fontSize: 11, color: cor.c5 }}>{tag}</div></div>
              <div className="m" style={{ fontSize: 15, color: c, whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${cor.g3}` }}>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}><div className="m" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c5 }}>Próximo DAS</div><div className="m" style={{ fontSize: 15 }}>20/10 · R$ 2.334</div></div>
            <div style={{ padding: '16px 22px', borderLeft: `1px solid ${cor.g3}`, display: 'flex', flexDirection: 'column', gap: 4 }}><div className="m" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c5 }}>Fator R</div><div className="m" style={{ fontSize: 15, color: cor.s }}>31% · Anexo III</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeitoPara() {
  return (
    <section style={{ borderTop: `1px solid ${cor.g2}`, borderBottom: `1px solid ${cor.g2}`, background: cor.g }} data-sem-reveal>
      <div className="wrap" style={{ paddingTop: 22, paddingBottom: 22, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div className="m" style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: cor.c5, flexShrink: 0 }}>Feito para</div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)' }}>
          <div className="marquee">
            {[0, 1].map((k) => (
              <div key={k} aria-hidden={k === 1} style={{ display: 'flex', gap: 40, paddingRight: 40 }}>
                {SEGMENTOS.map((x) => (
                  <span key={x} style={{ fontSize: 15, color: cor.c4, whiteSpace: 'nowrap', display: 'flex', gap: 40, alignItems: 'center' }}>
                    {x}<span style={{ width: 4, height: 4, background: cor.c7 }} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Recursos() {
  return (
    <section style={{ background: cor.p, color: cor.g, borderTop: `1px solid ${cor.c1}` }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <Rotulo>02 — Recursos</Rotulo>
          <h2 className="h2">É o fim da bagunça na gestão. Mesmo.</h2>
          <p className="corpo" style={{ color: cor.c7 }}>Contabilidade consultiva, finanças em tempo real e automação fiscal, integradas num só lugar.</p>
        </div>
        <div data-stagger="1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,340px),1fr))', gap: 1, background: cor.g, border: `1px solid ${cor.g}` }}>
          {RECURSOS.map(([chip, valor, titulo, corpo]) => (
            <div key={titulo} className="card-rec" style={{ background: cor.p, padding: '30px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 230 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div className="m" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c6 }}>{chip}</div>
                <div className="m" style={{ fontSize: 13, fontWeight: 500, background: cor.g, color: cor.s, padding: '5px 9px' }}>{valor}</div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.03em' }}>{titulo}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: cor.c7, textWrap: 'pretty' }}>{corpo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NaPratica() {
  return (
    <section id="na-pratica" style={{ background: cor.g }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <Rotulo c={cor.c5}>03 — Como fica na prática</Rotulo>
          <h2 className="h2">O que muda na rotina de quem toca a própria empresa.</h2>
          <p className="corpo" style={{ color: cor.c4 }}>Situações típicas de clientes de serviço. São exemplos, não depoimentos.</p>
        </div>
        <div data-stagger="1" style={grade(320)}>
          {NA_PRATICA.map(([perfil, ganho, texto]) => (
            <div key={perfil} className="card-dep" style={{ background: cor.g2, border: `1px solid ${cor.g2}`, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="m" style={{ fontSize: 13, color: cor.s, border: `1px solid ${cor.c7}`, alignSelf: 'flex-start', padding: '6px 10px' }}>{ganho}</div>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, textWrap: 'pretty' }}>{texto}</p>
              <div className="m" style={{ marginTop: 'auto', borderTop: `1px solid ${cor.c7}`, paddingTop: 18, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c5 }}>Exemplo · {perfil}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Atendimento() {
  return (
    <section style={{ background: cor.g2 }}>
      <div className="wrap sec" style={grade(420, 56)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Rotulo c={cor.c5}>05 — Atendimento de verdade</Rotulo>
          <h2 className="h2">Bateu a dúvida? Fala com a gente.</h2>
          <p className="corpo" style={{ color: cor.c4, maxWidth: 460 }}>Nada de robô que não resolve. Você fala direto com quem entende da sua empresa.</p>
        </div>
        <div data-stagger="1" style={{ ...grade(240, 1), background: cor.c7 }}>
          {ATENDIMENTO.map(([t, b], i) => (
            <div key={t} style={{ background: cor.g2, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="m" style={{ fontSize: 12, color: cor.s }}>{String(i + 1).padStart(2, '0')}</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>{t}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: cor.c4, textWrap: 'pretty' }}>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <FeitoPara />
      <Produto />
      <Recursos />
      <NaPratica />
      <Planos />
      <Atendimento />
      <Perguntas />
      <Contato />
    </>
  );
}
