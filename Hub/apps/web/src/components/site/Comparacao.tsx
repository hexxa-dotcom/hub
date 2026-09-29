'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLANOS, waLink, type Cobranca, type PlanoId } from '@/lib/site/planos';
import { ChaveCobranca, notaDaCobranca, linkCheckout, BlocosDePagamento, BlocoMei } from './HomeInterativo';

const G = '#0E0E10', P = '#F3F2EE', S = '#B9E86B', C2 = '#C9C8C2', C4 = '#B8B8B4', C5 = '#8A8A86', C6 = '#5A5A56';
const S_ = '✓', N_ = '—';
const COLS: [PlanoId, string][] = [
  ['sem-movimento', 'Sem faturamento'],
  ['simples-light', 'Simples Nacional'],
  ['simples-completo', 'Simples · mais escolhido'],
  ['presumido', 'Lucro Presumido'],
];
const DESTAQUE = 2;
const GRADE = { display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) repeat(4,minmax(0,1fr))' } as const;

const GRUPOS: [string, [string, ...string[]][]][] = [
  ['Para quem é', [
    ['Perfil', 'Empresa aberta, sem movimento', 'Começando no Simples', 'Prestador com faturamento', 'Serviço ou holding patrimonial'],
    ['Regime tributário', 'Qualquer', 'Simples Nacional', 'Simples Nacional', 'Lucro Presumido'],
    ['Faturamento', 'Sem movimento', 'Até R$ 10 mil/mês', 'Sem limite', 'Sem limite'],
  ]],
  ['Contabilidade e fiscal', [
    ['Obrigações e declarações em dia', S_, S_, S_, S_],
    ['Contabilidade completa', N_, S_, S_, S_],
    ['Emissão de notas fiscais', N_, 'Até 10/mês', 'Sem limite', 'Sem limite'],
    ['IRPJ e CSLL trimestrais, PIS e COFINS mensais', N_, N_, N_, S_],
    ['Receita de aluguel e distribuição de lucros', N_, N_, N_, S_],
  ]],
  ['Sócios', [['Pró-labore', 'Até 2 sócios', '1 sócio', 'Até 2 sócios', 'Até 2 sócios']]],
  ['Funções do Hub', [
    ['Contratos e propostas', N_, N_, S_, S_],
    ['Departamento pessoal (colaboradores)', N_, N_, S_, S_],
    ['Patrimonial', N_, N_, S_, S_],
    ['Relatórios avançados', N_, N_, S_, S_],
  ]],
  ['Preço', [
    ['Anual (por mês)', ...COLS.map(([id]) => `R$ ${PLANOS[id].anual}`)],
    ['Mês a mês', ...COLS.map(([id]) => `R$ ${PLANOS[id].mensal}`)],
    ['Economia no ano', ...COLS.map(([id]) => `R$ ${(PLANOS[id].mensal - PLANOS[id].anual) * 12}`)],
  ]],
];

export function Comparacao({ inicial }: { inicial: Cobranca }) {
  const [cobranca, setCobranca] = useState<Cobranca>(inicial);
  const celula = (i: number) => ({ borderLeft: `1px solid ${C2}`, background: i === DESTAQUE ? G : 'transparent' });

  return (
    <>
      <section style={{ background: G, color: P }}>
        <div className="wrap" style={{ paddingTop: 88, paddingBottom: 64, display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '24px 64px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="rot" style={{ color: C5 }}>Planos e preços</div>
              <h1 style={{ margin: 0, fontSize: 'clamp(40px,5.4vw,72px)', fontWeight: 600, letterSpacing: '-.055em', lineHeight: 0.98, textWrap: 'balance' }}>Compare e escolha com calma.</h1>
            </div>
            <p className="corpo" style={{ color: C4 }}>Preço fixo, sem surpresa no fim do mês. Anual em 12× no cartão, ou mês a mês no boleto, Pix ou cartão com 5% de desconto. A migração do seu contador atual é por nossa conta.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <ChaveCobranca valor={cobranca} mudar={setCobranca} escuro />
            <div className="m" style={{ fontSize: 12, color: C5 }}>{notaDaCobranca(cobranca)}</div>
          </div>
        </div>
      </section>

      <div className="so-celular m" style={{ background: P, color: C6, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', padding: '14px 16px 0' }}>Arraste a tabela para o lado →</div>
      <div className="tabela-rola" style={{ background: P, color: G }} data-sem-reveal>
        <div style={{ minWidth: 880 }}>
          <div className="tabela-topo" style={{ background: P, borderBottom: `1px solid ${G}` }}>
            <div className="wrap" style={GRADE}>
              <div className="col-fixa" style={{ padding: '22px 20px 22px 0', display: 'flex', alignItems: 'flex-end' }}>
                <div className="m" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C6 }}>Recursos</div>
              </div>
              {COLS.map(([id, tipo], i) => {
                const p = PLANOS[id];
                const f = i === DESTAQUE;
                return (
                  <div key={id} style={{ ...celula(i), padding: '22px 18px', color: f ? P : G, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 40 }}>
                      <div className="m" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: f ? S : C6 }}>{tipo}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>{p.nome}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span className="m" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.03em' }}>R$ {cobranca === 'anual' ? p.anual : p.mensal}</span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>/mês</span>
                      </div>
                      <div className="m" style={{ fontSize: 11, opacity: 0.6 }}>{cobranca === 'anual' ? `Economia R$ ${(p.mensal - p.anual) * 12}/ano` : `ou R$ ${p.anual} no anual`}</div>
                    </div>
                    <Link href={linkCheckout(id, cobranca) as never} className={f ? 'btn-s' : 'btn-g'} style={{ textAlign: 'center', fontSize: 14, padding: '11px 12px' }}>Contratar</Link>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wrap" style={{ paddingBottom: 72 }}>
            {GRUPOS.map(([nome, linhas], gi) => (
              <div key={nome} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...GRADE, borderBottom: `1px solid ${G}` }}>
                  <div className="col-fixa" style={{ padding: '40px 20px 14px 0', display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <span className="m" style={{ fontSize: 12, color: C6 }}>{String(gi + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.03em' }}>{nome}</span>
                  </div>
                  {COLS.map(([id], i) => <div key={id} style={celula(i)} />)}
                </div>
                {linhas.map(([rot, ...vals]) => (
                  <div key={rot} className="tabela-linha" style={{ ...GRADE, borderBottom: `1px solid ${C2}` }}>
                    <div className="col-fixa" style={{ padding: '16px 20px 16px 0', fontSize: 15, lineHeight: 1.4 }}>{rot}</div>
                    {vals.map((v, i) => {
                      const f = i === DESTAQUE;
                      const ink = v === N_ ? (f ? C6 : C5) : f ? (v === S_ ? S : P) : G;
                      return (
                        <div key={i} className="m" style={{ ...celula(i), padding: '16px 18px', color: ink, display: 'flex', alignItems: 'center', fontSize: v.length > 1 ? 13 : 16, lineHeight: 1.4 }}>
                          {v === S_ ? <span aria-label="Incluído">{v}</span> : v === N_ ? <span aria-label="Não incluído">{v}</span> : v}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
            <div style={GRADE}>
              <div className="col-fixa" />
              {COLS.map(([id], i) => (
                <div key={id} style={{ ...celula(i), padding: '24px 18px' }}>
                  <Link href={linkCheckout(id, cobranca) as never} className={i === DESTAQUE ? 'btn-s' : 'btn-g'} style={{ display: 'block', textAlign: 'center', fontSize: 14, padding: '13px 12px' }}>Contratar {PLANOS[id].nome}</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section style={{ background: P, color: G }}>
        <div className="wrap" style={{ paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <BlocosDePagamento />
          <BlocoMei cobranca={cobranca} />
        </div>
      </section>

      <section style={{ background: '#1C1C20', color: P }}>
        <div className="wrap" style={{ paddingTop: 88, paddingBottom: 88, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '40px 64px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(30px,3.6vw,46px)', fontWeight: 600, letterSpacing: '-.05em', lineHeight: 1.02, textWrap: 'balance' }}>Precisa de algo diferente?</h2>
            <p className="corpo" style={{ color: C4, maxWidth: 480 }}>Um especialista olha o momento da sua empresa e monta o plano certo. Sem compromisso.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={waLink('Olá, preciso de um plano sob medida')} target="_blank" rel="noopener noreferrer" className="btn-s" style={{ fontSize: 15, padding: '16px 22px' }}>Falar no WhatsApp →</a>
            <a href="/#contato" className="btn-o" style={{ fontSize: 15, padding: '16px 22px' }}>Pedir diagnóstico gratuito</a>
          </div>
        </div>
      </section>
    </>
  );
}
