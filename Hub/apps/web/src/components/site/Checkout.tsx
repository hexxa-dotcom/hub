'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cpfValido, cnpjValido } from '@hexxa/core/document-br';
import { PLANOS, ADICIONAIS, ADICIONAIS_MEI, brl, metodosPermitidos, valorMensal, waLink, type Cobranca, type MetodoPagamento, type PlanoId } from '@/lib/site/planos';
import { contratarAction, type ResultadoDoPedido } from '@/app/(site)/checkout/actions';

const G = '#0E0E10', G1 = '#1C1C20', P = '#F3F2EE', S = '#B9E86B', C1 = '#E1E0DA', C2 = '#C9C8C2', C4 = '#B8B8B4', C5 = '#8A8A86', C6 = '#5A5A56', C7 = '#3A3A38';
const ORDEM: PlanoId[] = ['mei', 'sem-movimento', 'simples-light', 'simples-completo', 'presumido'];
const PASSOS = ['Plano', 'Dados', 'Pagamento'];

function mascara(v: string, pad: string) {
  const d = v.replace(/\D/g, '');
  let out = '';
  let i = 0;
  for (const c of pad) {
    if (i >= d.length) break;
    out += c === '0' ? d[i++] : c;
  }
  return out;
}

const botaoBase = { appearance: 'none' as const, cursor: 'pointer' };
const h1 = { margin: 0, fontSize: 'clamp(30px,3.6vw,44px)', fontWeight: 600, letterSpacing: '-.05em', lineHeight: 1.02 } as const;

function Campo({ rotulo, erro, ...props }: { rotulo: string; erro?: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="campo claro">
      {rotulo}
      <input {...props} aria-invalid={!!erro} style={{ ...(props.inputMode === 'numeric' || props.inputMode === 'tel' ? { fontFamily: 'var(--font-mono), monospace' } : {}), ...(erro ? { borderColor: '#C2410C' } : {}) }} />
      {erro && <span style={{ fontSize: 12, letterSpacing: 0, textTransform: 'none', color: '#C2410C' }}>{erro}</span>}
    </label>
  );
}

export function Checkout({ planoInicial, cobrancaInicial }: { planoInicial: PlanoId; cobrancaInicial: Cobranca }) {
  const [passo, setPasso] = useState(0);
  const [plano, setPlano] = useState<PlanoId>(planoInicial);
  const [cobranca, setCobranca] = useState<Cobranca>(cobrancaInicial);
  const [metodo, setMetodo] = useState<MetodoPagamento>(cobrancaInicial === 'anual' ? 'cartao' : 'pix');
  const [temCnpj, setTemCnpj] = useState(true);
  const [f, setF] = useState({ cnpj: '', razao: '', nome: '', cpf: '', email: '', tel: '' });
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoDoPedido, { ok: true }> | null>(null);
  const [copiado, setCopiado] = useState(false);

  const p = PLANOS[plano];
  const anual = cobranca === 'anual';
  const cartaoMensal = !anual && metodo === 'cartao';
  const total = anual ? `12× ${brl(p.anual)}` : brl(valorMensal(p, cobranca, metodo));
  const notaTotal = anual
    ? `Total anual ${brl(p.anual * 12)}, em 12× no cartão. Economia de ${brl((p.mensal - p.anual) * 12)} no ano.`
    : cartaoMensal ? `Mês a mês no cartão, com 5% de desconto sobre ${brl(p.mensal)}.` : 'Renova todo mês, valor cheio no boleto ou Pix.';

  const erroCpf = f.cpf.length === 14 && !cpfValido(f.cpf) ? 'CPF inválido' : null;
  const erroCnpj = f.cnpj.length === 18 && !cnpjValido(f.cnpj) ? 'CNPJ inválido' : null;

  function mudarCobranca(c: Cobranca) {
    setCobranca(c);
    setMetodo(c === 'anual' ? 'cartao' : 'pix');
  }

  async function aoDigitarCnpj(v: string) {
    const cnpj = mascara(v, '00.000.000/0000-00');
    setF((s) => ({ ...s, cnpj }));
    if (cnpj.length !== 18 || !cnpjValido(cnpj) || f.razao) return;
    setBuscandoCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const j = (await r.json()) as { razao_social?: string };
        if (j.razao_social) setF((s) => ({ ...s, razao: s.razao || j.razao_social! }));
      }
    } catch {
      /* consulta é conveniência: sem ela, a pessoa digita */
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await contratarAction({ plano, cobranca, metodo, temCnpj, cnpj: f.cnpj, razao: f.razao, nome: f.nome, cpf: f.cpf, email: f.email, telefone: f.tel, aceite }).catch(() => ({ ok: false as const, erro: 'Não conseguimos concluir agora. Tente de novo ou fale com a gente no WhatsApp.' }));
    if (!r.ok) {
      setErro(r.erro);
      setEnviando(false);
      return;
    }
    if (r.paginaDoCartao) {
      window.location.href = r.paginaDoCartao; // cartão: página segura do Asaas
      return;
    }
    setResultado(r);
    setPasso(3);
    setEnviando(false);
    window.scrollTo({ top: 0 });
  }

  // ── Barra de passos ──
  const barra = (
    <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${G}` }}>
      {PASSOS.map((n, i) => {
        const volta = i < passo && passo < 3;
        return (
          <button key={n} type="button" onClick={() => volta && setPasso(i)} aria-current={i === passo ? 'step' : undefined} style={{ ...botaoBase, cursor: volta ? 'pointer' : 'default', border: 0, background: 'transparent', padding: '14px 20px 14px 0', marginRight: 20, display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 600, color: i <= passo ? G : C5, boxShadow: `inset 0 -3px 0 ${i === passo ? G : 'transparent'}`, transition: 'color .25s,box-shadow .25s' }}>
            <span className="m" style={{ fontSize: 11, fontWeight: 500, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < passo ? S : i === passo ? G : C1, color: i < passo ? G : i === passo ? P : C6 }}>{i < passo ? '✓' : i + 1}</span>
            {n}
          </button>
        );
      })}
    </div>
  );

  const voltar = (
    <button type="button" onClick={() => setPasso(passo - 1)} style={{ ...botaoBase, fontSize: 15, padding: '16px 20px', background: 'transparent', border: `1px solid ${C2}`, color: G }}>← Voltar</button>
  );

  return (
    <main className="wrap" style={{ flex: 1, maxWidth: 1160, width: '100%', boxSizing: 'border-box', paddingTop: 48, paddingBottom: 96, display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: '999 1 520px', minWidth: 0 }}>
        {passo < 3 && barra}

        {passo === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><h1 style={h1}>Escolha seu plano</h1><p style={{ margin: 0, fontSize: 15, color: C7 }}>Preço fixo, sem surpresa. Você pode trocar de plano depois.</p></div>
            <div role="radiogroup" aria-label="Forma de cobrança" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: `1px solid ${G}`, maxWidth: 440 }}>
              {([['anual', 'Anual', '12× no cartão'], ['mensal', 'Mês a mês', 'Boleto, Pix ou cartão']] as const).map(([id, nome, dica]) => {
                const on = cobranca === id;
                return (
                  <button key={id} role="radio" aria-checked={on} onClick={() => mudarCobranca(id)} style={{ ...botaoBase, border: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', background: on ? G : '#FFFFFF', color: on ? P : G, transition: 'background .25s,color .25s' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{nome}</span><span className="m" style={{ fontSize: 11, opacity: 0.7 }}>{dica}</span>
                  </button>
                );
              })}
            </div>
            <div role="radiogroup" aria-label="Plano" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ORDEM.map((id) => {
                const x = PLANOS[id];
                const on = id === plano;
                return (
                  <button key={id} role="radio" aria-checked={on} onClick={() => setPlano(id)} style={{ ...botaoBase, textAlign: 'left', padding: '22px 24px', background: on ? G : '#FFFFFF', color: on ? P : G, border: `1px solid ${on ? G : C2}`, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 18, alignItems: 'center', transition: 'background .25s,border-color .25s,color .25s' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${on ? S : C5}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: on ? S : 'transparent' }} /></span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>{x.nome}</span>
                        {x.destaque && <span className="m" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: on ? S : G, border: `1px solid ${on ? C7 : C2}`, padding: '3px 7px' }}>Mais escolhido</span>}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.75 }}>{x.descricao}</span>
                    </span>
                    <span className="m" style={{ fontSize: 20, fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'right' }}>R$ {anual ? x.anual : x.mensal}<span style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>{anual ? '/mês no anual' : '/mês'}</span></span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPasso(1)} className="btn-g" style={{ ...botaoBase, border: 0, alignSelf: 'flex-start', fontSize: 15, padding: '16px 24px' }}>Continuar →</button>
          </div>
        )}

        {passo === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (!erroCpf && !(temCnpj && erroCnpj)) setPasso(2); }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><h1 style={h1}>Seus dados</h1><p style={{ margin: 0, fontSize: 15, color: C7 }}>Usamos para criar seu acesso e emitir a cobrança.</p></div>
            <div style={{ display: 'flex', border: `1px solid ${G}`, alignSelf: 'flex-start' }}>
              {([[true, 'Já tenho CNPJ'], [false, 'Ainda não tenho']] as const).map(([v, n]) => (
                <button key={n} type="button" aria-pressed={temCnpj === v} onClick={() => setTemCnpj(v)} style={{ ...botaoBase, border: 0, padding: '11px 16px', fontSize: 14, fontWeight: 600, background: temCnpj === v ? G : 'transparent', color: temCnpj === v ? P : G }}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 16 }}>
              {temCnpj ? (
                <>
                  <Campo rotulo={buscandoCnpj ? 'CNPJ · consultando…' : 'CNPJ'} required value={f.cnpj} onChange={(e) => aoDigitarCnpj(e.target.value)} inputMode="numeric" placeholder="00.000.000/0000-00" erro={erroCnpj} />
                  <Campo rotulo="Razão social" required value={f.razao} onChange={(e) => setF({ ...f, razao: e.target.value })} placeholder="Sua Empresa Ltda" />
                </>
              ) : (
                <div style={{ gridColumn: '1 / -1', background: G, color: P, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span className="m" style={{ color: S }}>→</span>
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: C4 }}>Sem problema. A Hexx abre o CNPJ e escolhe o enquadramento certo. Um contador entra em contato em até 1 dia útil para começar.</span>
                </div>
              )}
              <Campo rotulo="Nome completo" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Como está no documento" autoComplete="name" />
              <Campo rotulo="CPF" required value={f.cpf} onChange={(e) => setF({ ...f, cpf: mascara(e.target.value, '000.000.000-00') })} inputMode="numeric" placeholder="000.000.000-00" erro={erroCpf} />
              <Campo rotulo="E-mail" required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="voce@empresa.com.br" autoComplete="email" />
              <Campo rotulo="WhatsApp" required value={f.tel} onChange={(e) => setF({ ...f, tel: mascara(e.target.value, '(00) 00000-0000') })} inputMode="tel" placeholder="(00) 00000-0000" autoComplete="tel" />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {voltar}
              <button type="submit" className="btn-g" style={{ ...botaoBase, border: 0, fontSize: 15, padding: '16px 24px' }}>Ir para pagamento →</button>
            </div>
          </form>
        )}

        {passo === 2 && (
          <form onSubmit={pagar} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><h1 style={h1}>Pagamento</h1><p style={{ margin: 0, fontSize: 15, color: C7 }}>A primeira mensalidade libera seu acesso.</p></div>
            <div role="radiogroup" aria-label="Forma de pagamento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', border: `1px solid ${G}` }}>
              {metodosPermitidos(cobranca).map((id) => {
                const on = id === metodo;
                const [nome, dica] = anual ? ['Cartão', '12× pelo valor do anual'] : ({ pix: ['Pix', 'Valor cheio'], boleto: ['Boleto', 'Valor cheio'], cartao: ['Cartão', '5% de desconto'] } as const)[id];
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setMetodo(id)} style={{ ...botaoBase, border: 0, borderRight: `1px solid ${G}`, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', background: on ? G : '#FFFFFF', color: on ? P : G, transition: 'background .25s,color .25s' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{nome}</span><span className="m" style={{ fontSize: 11, opacity: 0.7 }}>{dica}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C2}`, padding: 20, fontSize: 14, lineHeight: 1.55, color: C7 }}>
              {metodo === 'cartao'
                ? `${anual ? 'Plano anual em 12× no cartão, pelo valor do anual.' : 'Mês a mês no cartão, com 5% de desconto todo mês.'} Você digita os dados do cartão na página segura do Asaas, nosso parceiro de pagamentos. A Hexx não vê nem guarda o número do cartão.`
                : metodo === 'pix'
                  ? 'O QR Code e o código copia e cola aparecem na próxima tela. A confirmação é instantânea.'
                  : 'O boleto vence em 3 dias. Seu acesso é liberado assim que o pagamento compensar, em até 2 dias úteis.'}
            </div>
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: C7, cursor: 'pointer' }}>
              <input required type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: 18, height: 18, margin: '1px 0 0', accentColor: G }} />
              <span>Li e aceito os <Link href={'/termos' as never} target="_blank" style={{ textDecoration: 'underline' }}>termos de uso e o contrato de serviços</Link> e a <Link href={'/privacidade' as never} target="_blank" style={{ textDecoration: 'underline' }}>política de privacidade</Link>.</span>
            </label>
            {erro && <div role="alert" style={{ fontSize: 14, color: '#C2410C' }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {voltar}
              <button type="submit" disabled={enviando} className="btn-s" style={{ ...botaoBase, border: 0, fontSize: 15, padding: '16px 24px', minWidth: 220 }}>
                {enviando ? 'Processando…' : `${metodo === 'pix' ? 'Gerar Pix' : metodo === 'boleto' ? 'Gerar boleto' : `Pagar ${total} no cartão`} →`}
              </button>
            </div>
          </form>
        )}

        {passo === 3 && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <img src="/brand/hexx-simbolo-positivo.svg" alt="" style={{ height: 64, width: 'auto', alignSelf: 'flex-start' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h1 style={{ ...h1, fontSize: 'clamp(30px,3.6vw,48px)', textWrap: 'balance' }}>
                {resultado.semCobranca ? 'Recebemos seu pedido.' : metodo === 'pix' ? 'Falta só o Pix.' : 'Boleto gerado.'}
              </h1>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: C7, maxWidth: 560, textWrap: 'pretty' }}>
                {resultado.semCobranca
                  ? 'Um especialista da Hexx confere seus dados e envia o link de pagamento pelo WhatsApp e e-mail em até 1 dia útil.'
                  : metodo === 'pix'
                    ? 'Pague com o QR Code ou o código abaixo. Assim que o pagamento cair, enviamos seu acesso por e-mail e WhatsApp.'
                    : 'Abra o boleto pelo botão abaixo. Ele também chega no seu e-mail. Seu acesso é liberado assim que o pagamento compensar.'}
              </p>
            </div>
            {resultado.pix && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,148px),max-content))', gap: 24, alignItems: 'center', background: '#FFFFFF', border: `1px solid ${C2}`, padding: 24 }}>
                {resultado.pix.imagem && <img src={resultado.pix.imagem} alt="QR Code do Pix" style={{ width: 148, height: 148 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                  <div className="rot" style={{ fontSize: 11, color: C6 }}>Pix copia e cola</div>
                  <div className="m" style={{ fontSize: 12, wordBreak: 'break-all', color: C7, background: P, padding: 12 }}>{resultado.pix.copiaECola}</div>
                  <button onClick={() => { navigator.clipboard?.writeText(resultado.pix!.copiaECola).catch(() => {}); setCopiado(true); }} className="btn-g" style={{ ...botaoBase, border: 0, alignSelf: 'flex-start', fontSize: 14, padding: '12px 18px' }}>{copiado ? 'Copiado ✓' : 'Copiar código'}</button>
                </div>
              </div>
            )}
            {resultado.boletoUrl && (
              <a href={resultado.boletoUrl} target="_blank" rel="noopener noreferrer" className="btn-s" style={{ alignSelf: 'flex-start', fontSize: 15, padding: '16px 24px' }}>Abrir o boleto →</a>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${G}` }}>
              {['Você recebe o acesso por e-mail e WhatsApp.', temCnpj ? 'Seu contador entra em contato em até 1 dia útil.' : 'Seu contador inicia a abertura do CNPJ em até 1 dia útil.', 'Conecte sua conta PJ e emita a primeira nota.'].map((t, i) => (
                <div key={t} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: `1px solid ${C2}`, fontSize: 15 }}><span className="m" style={{ fontSize: 12, color: C6, paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>{t}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={waLink(`Olá, acabei de contratar o plano ${p.nome} pelo site.`)} target="_blank" rel="noopener noreferrer" className="btn-g" style={{ fontSize: 15, padding: '16px 24px' }}>Falar no WhatsApp →</a>
              <Link href="/" style={{ fontSize: 15, padding: '16px 20px', border: `1px solid ${C2}` }}>Voltar ao site</Link>
            </div>
          </div>
        )}
      </div>

      <aside style={{ background: G, color: P, display: 'flex', flexDirection: 'column', position: 'sticky', top: 24, flex: '1 1 300px', minWidth: 0 }}>
        <div className="rot" style={{ padding: '22px 24px', borderBottom: `1px solid ${G1}`, fontSize: 11, color: C5 }}>Resumo</div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${G1}` }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>{p.nome}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C5 }}>{p.descricao}</div>
        </div>
        {p.itens.slice(0, 4).map((it) => (
          <div key={it} style={{ padding: '12px 24px', borderBottom: `1px solid ${G1}`, display: 'flex', gap: 12, fontSize: 14, color: C4 }}><span className="m" style={{ color: S }}>+</span>{it}</div>
        ))}
        <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: C4, borderBottom: `1px solid ${G1}` }}><span>Cobrança</span><span className="m" style={{ textAlign: 'right' }}>{anual ? 'Anual · 12× no cartão' : 'Mês a mês'}</span></div>
        <div style={{ padding: '22px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 14 }}>{anual ? 'Parcelas' : 'Total hoje'}</span>
          <span className="m" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.03em', color: S, whiteSpace: 'nowrap' }}>{total}</span>
        </div>
        <div style={{ padding: '0 24px 20px', fontSize: 12, lineHeight: 1.5, color: C5 }}>{notaTotal}</div>
        <div style={{ padding: '16px 24px 22px', borderTop: `1px solid ${G1}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="m" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C5 }}>Adicionais, se precisar</div>
          {(plano === 'mei' ? ADICIONAIS_MEI : ADICIONAIS).map((x) => (
            <div key={x.item} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: C4 }}><span>{x.item}</span><span className="m" style={{ whiteSpace: 'nowrap' }}>{x.valor}</span></div>
          ))}
        </div>
      </aside>
    </main>
  );
}
