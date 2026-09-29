'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLANOS, ADICIONAIS, REGRAS_PAGAMENTO, waLink, type Cobranca, type PlanoId } from '@/lib/site/planos';

const cor = { g: '#0E0E10', g2: '#1C1C20', g3: '#2A2A2E', p: '#F3F2EE', s: '#B9E86B', c1: '#E1E0DA', c2: '#C9C8C2', c4: '#B8B8B4', c5: '#8A8A86', c6: '#5A5A56', c7: '#3A3A38' };
const mono = { fontFamily: 'var(--font-mono), monospace' } as const;
const grade = (n: number, gap: number | string = 20) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${n}px),1fr))`, gap });

// ── Dados ilustrativos do painel (PENDENTE no handoff: confirmar se ficam) ──

type Aba = { nome: string; titulo: string; corpo: string; painel: string; status: string; linhas: [string, string, boolean?][] };
const ABAS: Aba[] = [
  { nome: 'Caixa & Cobranças', titulo: 'Fluxo de caixa inteligente, conciliação e cobranças por Pix ou boleto.', corpo: 'Cada centavo que entra ou sai é categorizado automaticamente. Emita cobranças por Pix dinâmico ou boleto com baixa automática direto no caixa.', painel: 'Caixa · Outubro', status: 'Conciliado ✓', linhas: [['Contrato mensal · Cliente Prime', '+ R$ 14.500,00', true], ['Cobrança Pix liquidada', '+ R$ 6.800,00', true], ['Servidores e ferramentas SaaS', '− R$ 840,00']] },
  { nome: 'NFSe 1-clique', titulo: 'Nota fiscal de serviço emitida em segundos.', corpo: 'Integração com o emissor nacional: você escolhe o cliente, confirma o valor e a nota sai com os impostos já calculados. A cobrança vai junto.', painel: 'NFSe · Emissão', status: 'Autorizada ✓', linhas: [['Tomador', 'Studio Craft Ltda'], ['Valor do serviço', 'R$ 6.800,00'], ['ISS retido', 'R$ 0,00', true]] },
  { nome: 'Propostas & Contratos', titulo: 'A proposta vira contrato assinado.', corpo: 'Envie orçamentos profissionais com aceite e assinatura digital com validade jurídica. O cliente assina pelo celular e a nota já fica engatilhada.', painel: 'Proposta #0348', status: 'Assinada ✓', linhas: [['Cliente', 'Mariana Castro'], ['Valor', 'R$ 9.600,00'], ['Assinatura', 'ICP-Brasil', true]] },
  { nome: 'Bússola Tributária', titulo: 'O menor imposto possível, monitorado todo mês.', corpo: 'O Termômetro do Fator R acompanha a folha sobre o faturamento e avisa quando é hora de ajustar o pró-labore para manter a menor alíquota.', painel: 'Simples Nacional', status: 'Anexo III', linhas: [['Fator R', '31%', true], ['Alíquota efetiva', '6,00%'], ['Próximo DAS', '20/10 · R$ 2.334']] },
  { nome: 'Lucros & Cofre', titulo: 'Quanto você pode tirar, sem risco.', corpo: 'Controle exato de quanto transferir para a conta PF, com recibos legais e total conformidade contábil na distribuição de lucros.', painel: 'Retirada de sócios', status: 'Isento de IR', linhas: [['Lucro disponível', 'R$ 21.460,00', true], ['Pró-labore', 'R$ 4.200,00'], ['Reserva no cofre', 'R$ 8.000,00']] },
];




const FAQ = [
  ['A Hexx é só uma contabilidade?', 'Não. A contabilidade é a base; o que você recebe é um hub completo de gestão: finanças, contratos, assinatura digital, impostos e relatórios, com um time que conhece empresas de serviço por dentro.'],
  ['Pra quem é a Hexx?', 'Para empresas de serviço, principalmente profissionais que tocam o negócio sozinhos ou com equipe enxuta: consultores, designers, desenvolvedores, terapeutas, advogados e afins.'],
  ['Ainda não tenho CNPJ. Posso usar?', 'Pode. A Hexx abre o CNPJ, escolhe o enquadramento tributário certo e entrega sua empresa já funcionando dentro da plataforma.'],
  ['Já tenho contador. Consigo migrar?', 'Sim, e a migração é por nossa conta. Solicitamos os documentos ao seu contador atual e fazemos toda a transição.'],
  ['A assinatura digital tem validade jurídica?', 'Sim. Os contratos seguem a legislação brasileira de assinaturas eletrônicas, com trilha de auditoria completa: quem assinou, quando e de onde.'],
  ['Como funciona o cálculo de impostos?', 'A Hexx acompanha seu faturamento, calcula os impostos do seu enquadramento, gera as guias e avisa antes do vencimento. Você só confirma o pagamento.'],
  ['Como funcionam os planos e pagamentos?', 'No anual, você paga em 12× no cartão pelo valor do anual. No mês a mês, paga o valor cheio no boleto ou Pix, ou com 5% de desconto no cartão. Colaborador ou sócio adicional custa R$ 50/mês cada, e admissão ou rescisão, R$ 150 por evento.'],
];

const AREAS = ['Consultoria / Assessoria', 'Tecnologia / Software', 'Design / Criativo / Agência', 'Saúde / Bem-estar', 'Advocacia / Jurídico', 'Educação / Mentorias', 'Holding / Gestão patrimonial', 'Outros serviços'];

export function Rotulo({ children, c = cor.c6 }: { children: React.ReactNode; c?: string }) {
  return <div className="rot" style={{ color: c }}>{children}</div>;
}

// ── Hero ────────────────────────────────────────────────────────────────
export function Saldo() {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(48920);
    const t0 = performance.now();
    let raf = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - t0) / 1400);
      setV(48920 * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <>R$ {v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

// ── 01 Produto ──────────────────────────────────────────────────────────
export function Produto() {
  const [aba, setAba] = useState(0);
  const [sumindo, setSumindo] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const escolher = (i: number) => {
    if (i === aba) return;
    setSumindo(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => { setAba(i); setSumindo(false); }, 200);
  };
  const a = ABAS[aba]!;
  return (
    <section id="produto" style={{ background: cor.p, color: cor.g }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ ...grade(420, '24px 64px'), alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><Rotulo>01 — A Hexx por dentro</Rotulo><h2 className="h2">Tudo o que sua empresa de serviço precisa. Em uma só tela.</h2></div>
          <p className="corpo" style={{ color: cor.c7 }}>Chega de colcha de retalhos com vários softwares avulsos. Na Hexx você gerencia o negócio com autonomia, e a contabilidade opera em tempo real nos bastidores.</p>
        </div>
        <div role="tablist" className="abas-produto" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${cor.g}` }}>
          {ABAS.map((x, i) => {
            const ativa = i === aba;
            return (
              <button key={x.nome} role="tab" aria-selected={ativa} onClick={() => escolher(i)} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '16px 22px', fontSize: 15, fontWeight: 600, background: ativa ? cor.g : 'transparent', color: ativa ? cor.p : cor.g, display: 'flex', gap: 10, alignItems: 'center', boxShadow: `inset 0 -3px 0 ${ativa ? cor.s : 'transparent'}`, transition: 'background .3s ease,color .3s ease,box-shadow .3s ease' }}>
                <span className="m" style={{ fontSize: 11, fontWeight: 500, opacity: 0.6 }}>{String(i + 1).padStart(2, '0')}</span>{x.nome}
              </button>
            );
          })}
        </div>
        <div style={{ ...grade(420, 48), alignItems: 'center', opacity: sumindo ? 0 : 1, transform: `translateY(${sumindo ? 8 : 0}px)`, transition: 'opacity .22s ease,transform .22s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ margin: 0, fontSize: 'clamp(26px,3vw,36px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.08, textWrap: 'balance' }}>{a.titulo}</h3>
            <p className="corpo" style={{ color: cor.c7 }}>{a.corpo}</p>
            <a href="#planos" className="btn-g" style={{ alignSelf: 'flex-start', fontSize: 15, padding: '14px 20px' }}>Experimentar a Hexx →</a>
          </div>
          <div style={{ background: cor.g, color: cor.p, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: `1px solid ${cor.g2}` }}>
              <div className="m" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: cor.c5 }}>{a.painel}</div>
              <div className="m" style={{ fontSize: 11, color: cor.s }}>{a.status}</div>
            </div>
            {a.linhas.map(([k, v, hi]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 22px', borderBottom: `1px solid ${cor.g2}` }}>
                <div style={{ fontSize: 14, color: cor.c4 }}>{k}</div>
                <div className="m" style={{ fontSize: 15, color: hi ? cor.s : cor.p, textAlign: 'right', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 04 Planos ───────────────────────────────────────────────────────────
export function ChaveCobranca({ valor, mudar, escuro = false }: { valor: Cobranca; mudar: (c: Cobranca) => void; escuro?: boolean }) {
  const borda = escuro ? cor.c7 : cor.g;
  return (
    <div role="radiogroup" aria-label="Forma de cobrança" style={{ display: 'flex', border: `1px solid ${borda}` }}>
      {(['anual', 'mensal'] as const).map((id) => {
        const on = valor === id;
        return (
          <button key={id} role="radio" aria-checked={on} onClick={() => mudar(id)} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '12px 18px', fontSize: 14, fontWeight: 600, background: on ? (escuro ? cor.p : cor.g) : 'transparent', color: on ? (escuro ? cor.g : cor.p) : escuro ? cor.c4 : cor.g, transition: 'background .25s,color .25s' }}>
            {id === 'anual' ? 'Anual' : 'Mês a mês'}
          </button>
        );
      })}
    </div>
  );
}

export const notaDaCobranca = (c: Cobranca) => (c === 'anual' ? '12× no cartão, pelo valor do anual' : 'Boleto ou Pix · cartão com 5% de desconto');
export const linkCheckout = (id: PlanoId, c: Cobranca) => `/checkout?plano=${id}&cobranca=${c}`;

function precoDe(id: PlanoId, c: Cobranca) {
  const p = PLANOS[id];
  const eco = (p.mensal - p.anual) * 12;
  return c === 'anual'
    ? { preco: `R$ ${p.anual}`, por: '/mês no anual', alt: `Economia de R$ ${eco} no ano · ou R$ ${p.mensal} mês a mês` }
    : { preco: `R$ ${p.mensal}`, por: '/mês', alt: `ou R$ ${p.anual}/mês no anual, economia de R$ ${eco}` };
}

function CartaoPlano({ tipo, nome, id, cobranca, destaque, variantes, rodape }: {
  tipo: string; nome: string; id: PlanoId; cobranca: Cobranca; destaque?: boolean;
  variantes?: { ids: PlanoId[]; atual: PlanoId; mudar: (id: PlanoId) => void };
  rodape?: { texto: string; href: string };
}) {
  const p = PLANOS[id];
  const { preco, por, alt } = precoDe(id, cobranca);
  const linha = destaque ? cor.c7 : cor.c2;
  const curto = variantes ? p.nome : nome;
  return (
    <div className="card-plano" style={{ background: destaque ? cor.g : cor.p, color: destaque ? cor.p : cor.g, border: `1px solid ${cor.g}`, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 26 }}>
        <div className="m" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.7 }}>{tipo}</div>
        {destaque && <div className="m" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: cor.s, color: cor.g, padding: '5px 9px' }}>Mais escolhido</div>}
      </div>
      <h3 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-.035em' }}>{nome}</h3>
      {variantes && (
        <div role="radiogroup" aria-label="Variante do Simples" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `1px solid ${cor.c7}` }}>
          {variantes.ids.map((vid) => {
            const on = variantes.atual === vid;
            return (
              <button key={vid} role="radio" aria-checked={on} onClick={() => variantes.mudar(vid)} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '10px 12px', fontSize: 13, fontWeight: 600, background: on ? cor.p : 'transparent', color: on ? cor.g : cor.c4, transition: 'background .25s,color .25s' }}>
                {PLANOS[vid].nome.replace('Simples ', '')}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span className="m" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-.04em' }}>{preco}</span>
          <span style={{ fontSize: 14, opacity: 0.7 }}>{por}</span>
        </div>
        <div className="m" style={{ fontSize: 12, opacity: 0.65 }}>{alt}</div>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, opacity: 0.85, textWrap: 'pretty' }}>{p.descricao}</p>
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${linha}` }}>
        {p.itens.map((it) => (
          <div key={it} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: `1px solid ${linha}`, fontSize: 14, lineHeight: 1.45 }}>
            <span className="m" style={{ color: destaque ? cor.s : cor.g }}>+</span><span>{it}</span>
          </div>
        ))}
      </div>
      <Link href={linkCheckout(id, cobranca) as never} className={destaque ? 'btn-s' : 'btn-g'} style={{ marginTop: 'auto', textAlign: 'center', fontSize: 15, padding: '15px 20px' }}>
        Contratar {curto}
      </Link>
      {rodape && (
        <a href={rodape.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, lineHeight: 1.45, textDecoration: 'underline', textUnderlineOffset: 3 }}>{rodape.texto}</a>
      )}
    </div>
  );
}

export function BlocosDePagamento() {
  const caixa = { background: cor.p, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 12 };
  const lin = { display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14, flexWrap: 'wrap' as const };
  return (
    <div style={{ ...grade(300, 1), background: cor.c2, border: `1px solid ${cor.c2}`, color: cor.g }}>
      <div style={caixa}><Rotulo>Em todos os planos</Rotulo>{ADICIONAIS.map((x) => <div key={x.item} style={lin}><span>{x.item}</span><span className="m">{x.valor}</span></div>)}</div>
      <div style={caixa}><Rotulo>Pagamento</Rotulo>{REGRAS_PAGAMENTO.map((x) => <div key={x.item} style={lin}><span>{x.item}</span><span className="m" style={{ fontSize: 13 }}>{x.valor}</span></div>)}</div>
      <div style={{ background: cor.g, color: cor.p, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>Precisa de algo diferente?</div>
        <a href={waLink('Olá, preciso de um plano sob medida')} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 600, color: cor.s }}>Fale com a gente →</a>
      </div>
    </div>
  );
}

export function BlocoMei({ cobranca }: { cobranca: Cobranca }) {
  const { preco, por } = precoDe('mei', cobranca);
  const p = PLANOS.mei;
  return (
    <div style={{ background: cor.g2, color: cor.p, padding: '32px 28px', ...grade(300, '28px 48px'), alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Rotulo c={cor.s}>Você é MEI?</Rotulo>
        <h3 style={{ margin: 0, fontSize: 'clamp(24px,2.6vw,32px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.08 }}>Temos uma condição especial pra você.</h3>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: cor.c4 }}>{p.descricao}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span className="m" style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-.04em' }}>{preco}</span>
            <span style={{ fontSize: 14, color: cor.c4 }}>{por}</span>
          </div>
          <div className="m" style={{ fontSize: 12, color: cor.c5 }}>{cobranca === 'anual' ? `ou R$ ${p.mensal} mês a mês · economia de R$ ${(p.mensal - p.anual) * 12} no ano` : `ou R$ ${p.anual}/mês no anual`}</div>
        </div>
        <Link href={linkCheckout('mei', cobranca) as never} className="btn-s" style={{ alignSelf: 'flex-start', fontSize: 15, padding: '14px 20px' }}>Contratar MEI →</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${cor.c7}` }}>
        {p.itens.map((it) => (
          <div key={it} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: `1px solid ${cor.c7}`, fontSize: 14, lineHeight: 1.45 }}>
            <span className="m" style={{ color: cor.s }}>+</span><span>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Planos() {
  const [cobranca, setCobranca] = useState<Cobranca>('anual');
  const [simples, setSimples] = useState<PlanoId>('simples-completo');
  return (
    <section id="planos" style={{ background: cor.p, color: cor.g }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ ...grade(420, '24px 64px'), alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><Rotulo>04 — Planos</Rotulo><h2 className="h2">Sob medida para o momento da sua empresa.</h2></div>
          <p className="corpo" style={{ color: cor.c7 }}>Preço fixo, sem surpresa no fim do mês e com suporte direto de quem entende do seu negócio.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <ChaveCobranca valor={cobranca} mudar={setCobranca} />
          <div className="m" style={{ fontSize: 12, color: cor.c6 }}>{notaDaCobranca(cobranca)}</div>
        </div>
        <div data-stagger="1" style={{ ...grade(300), alignItems: 'stretch' }}>
          <CartaoPlano tipo="Sem movimento" nome="Sem movimento" id="sem-movimento" cobranca={cobranca} />
          <CartaoPlano tipo="Simples Nacional" nome="Simples" id={simples} cobranca={cobranca} destaque variantes={{ ids: ['simples-completo', 'simples-light'], atual: simples, mudar: setSimples }} />
          <CartaoPlano tipo="Lucro Presumido" nome="Presumido" id="presumido" cobranca={cobranca} rodape={PLANOS.presumido.rodape} />
        </div>
        <BlocosDePagamento />
        <BlocoMei cobranca={cobranca} />
        <Link href={`/planos?cobranca=${cobranca}` as never} style={{ alignSelf: 'flex-start', fontSize: 15, fontWeight: 600, borderBottom: `1px solid ${cor.g}`, paddingBottom: 4 }}>
          Ver a comparação completa de recursos e valores →
        </Link>
      </div>
    </section>
  );
}

export function Perguntas() {
  const [aberta, setAberta] = useState(0);
  return (
    <section id="faq" style={{ background: cor.p, color: cor.g }}>
      <div className="wrap sec" style={{ ...grade(380, 56), alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><Rotulo>06 — Perguntas frequentes</Rotulo><h2 className="h2">Antes de começar.</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${cor.g}` }}>
          {FAQ.map(([q, a], i) => {
            const on = aberta === i;
            return (
              <div key={q} style={{ borderBottom: `1px solid ${cor.g}` }}>
                <button aria-expanded={on} onClick={() => setAberta(on ? -1 : i)} style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', color: cor.g }}>
                  <span>{q}</span>
                  <span className="m" style={{ fontSize: 22, fontWeight: 400, flexShrink: 0, display: 'inline-block', transform: `rotate(${on ? 45 : 0}deg)`, transition: 'transform .3s ease' }}>+</span>
                </button>
                <div style={{ display: 'grid', gridTemplateRows: on ? '1fr' : '0fr', transition: 'grid-template-rows .35s ease' }}>
                  <div style={{ overflow: 'hidden', minHeight: 0 }}>
                    <p style={{ margin: 0, padding: '0 48px 24px 0', fontSize: 16, lineHeight: 1.6, color: cor.c7, textWrap: 'pretty' }}>{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Contato() {
  const [estado, setEstado] = useState<'form' | 'enviando' | 'ok' | 'erro'>('form');
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('empresa_site')) return; // honeypot
    setEstado('enviando');
    const r = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: f.get('nome'), email: f.get('email'), whats: f.get('whats'), area: f.get('area') }),
    }).catch(() => null);
    setEstado(r?.ok ? 'ok' : 'erro');
  }
  return (
    <section id="contato" style={{ background: cor.g2, color: cor.p, position: 'relative', overflow: 'hidden' }}>
      <img src="/brand/hexx-simbolo-branco.svg" alt="" style={{ position: 'absolute', left: -120, bottom: -160, height: 620, width: 'auto', opacity: 0.04, pointerEvents: 'none' }} />
      <div className="wrap sec" style={{ position: 'relative', ...grade(420, 56), alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(38px,5vw,64px)', fontWeight: 600, letterSpacing: '-.055em', lineHeight: 0.98, textWrap: 'balance' }}>Pronto para simplificar sua rotina?</h2>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, maxWidth: 460, color: cor.c4 }}>Tire suas dúvidas ou peça um diagnóstico gratuito da sua empresa direto com um especialista.</p>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${cor.c7}`, maxWidth: 460 }}>
            {['Diagnóstico gratuito e sem compromisso', 'Demonstração da Hexx funcionando', 'Atendimento direto com especialista'].map((k) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: `1px solid ${cor.c7}`, fontSize: 15 }}><span className="m" style={{ color: cor.s }}>→</span>{k}</div>
            ))}
          </div>
        </div>
        <div style={{ background: cor.g, border: `1px solid ${cor.g3}`, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {estado === 'ok' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 0' }}>
              <img src="/brand/hexx-simbolo-sinal.svg" alt="" style={{ height: 56, width: 'auto', alignSelf: 'flex-start' }} />
              <h3 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.03em' }}>Recebemos seu contato.</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: cor.c4 }}>Um especialista da Hexx responde em até 1 dia útil.</p>
            </div>
          ) : (
            <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input name="empresa_site" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
              <label className="campo">Nome completo<input name="nome" required type="text" autoComplete="name" /></label>
              <label className="campo">E-mail profissional<input name="email" required type="email" autoComplete="email" /></label>
              <label className="campo">WhatsApp com DDD<input name="whats" required type="tel" autoComplete="tel" /></label>
              <label className="campo">Área de atuação
                <select name="area" required defaultValue=""><option value="">Selecione sua atividade</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
              </label>
              <button type="submit" disabled={estado === 'enviando'} className="btn-s" style={{ appearance: 'none', border: 0, cursor: 'pointer', marginTop: 6, fontSize: 16, padding: '17px 20px' }}>
                {estado === 'enviando' ? 'Enviando…' : 'Quero conhecer a Hexx →'}
              </button>
              <div style={{ fontSize: 12, color: estado === 'erro' ? '#F2A38F' : cor.c5 }}>
                {estado === 'erro' ? 'Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp.' : 'Seus dados estão seguros. Resposta em até 1 dia útil.'}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
