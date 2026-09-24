'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, FileUp, Loader2, Sparkles, X } from 'lucide-react';
import { MODELOS, INDICES, AREAS, type ModeloDeContrato, type IndiceDeReajuste } from './modelos-info';
import { consultarParteAction, criarContratoAction } from './contratos-actions';
import { sugerirTextoContratoAction } from './unified-actions';
import { AssinarContrato, type ContratoParaAssinar } from './AssinarContrato';

/**
 * NOVO CONTRATO — em três passos.
 *
 *   1. Qual contrato: um modelo pronto (cliente, profissional PJ,
 *      fornecedor) ou o seu próprio PDF.
 *   2. Com quem e quanto: pelo CNPJ o Hub preenche nome e endereço, e diz se
 *      a outra parte usa o Hub (aí ela assina e recebe tudo lá dentro).
 *   3. Revisar e assinar: cria o contrato e já abre a assinatura.
 *
 * As parcelas só entram no financeiro quando as duas partes assinarem.
 */

type Modelo = ModeloDeContrato | 'PROPRIO';

const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const maisUmAno = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function mascaraDoc(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="rotulo text-ink-soft">{children}</span>;
}

export function NovoContrato({
  tipoInicial,
  onClose,
  onDone,
}: {
  tipoInicial: 'ENTRADA' | 'SAIDA';
  onClose: () => void;
  onDone: (mensagem: string) => void;
}) {
  const [passo, setPasso] = useState(1);
  const [modelo, setModelo] = useState<Modelo>(tipoInicial === 'ENTRADA' ? 'CLIENTE' : 'PJ');
  const [tipoProprio, setTipoProprio] = useState<'ENTRADA' | 'SAIDA'>(tipoInicial);
  const [pdf, setPdf] = useState<{ base64: string; nome: string } | null>(null);
  const [jaAssinado, setJaAssinado] = useState(false);
  const [assinadoEm, setAssinadoEm] = useState(hoje());

  const [documento, setDocumento] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [usaOHub, setUsaOHub] = useState<boolean | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [avisoParte, setAvisoParte] = useState<string | null>(null);

  const [area, setArea] = useState('');
  const [objeto, setObjeto] = useState('');
  const [melhorando, setMelhorando] = useState(false);
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('10');
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(maisUmAno(hoje()));
  const [indice, setIndice] = useState<IndiceDeReajuste>('IPCA');
  const [forma, setForma] = useState('Pix ou boleto bancário');
  const [emitirNota, setEmitirNota] = useState(false);

  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [paraAssinar, setParaAssinar] = useState<ContratoParaAssinar | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const escolheTipo = modelo === 'PROPRIO' || MODELOS[modelo].tipo === null;
  const tipo: 'ENTRADA' | 'SAIDA' = escolheTipo ? tipoProprio : MODELOS[modelo as ModeloDeContrato].tipo!;
  const quem = escolheTipo ? (tipo === 'ENTRADA' ? 'Cliente' : 'Contratado') : MODELOS[modelo as ModeloDeContrato].parte;
  const valorNumero = Number(valor.replace(/\./g, '').replace(',', '.'));

  // Consulta a outra parte assim que o CNPJ estiver completo.
  useEffect(() => {
    const d = documento.replace(/\D/g, '');
    setUsaOHub(null);
    setAvisoParte(null);
    if (d.length !== 14) return;
    let vivo = true;
    setConsultando(true);
    consultarParteAction(d)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) return setAvisoParte(r.message);
        setNome(r.nome);
        if (r.endereco) setEndereco(r.endereco);
        if (r.email && !email) setEmail(r.email);
        setUsaOHub(r.usaOHub);
      })
      .finally(() => vivo && setConsultando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento]);

  function lerPdf(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') return setErro('O contrato precisa estar em PDF.');
    if (file.size > 3 * 1024 * 1024) return setErro('O PDF pode ter até 3 MB.');
    setErro(null);
    const r = new FileReader();
    r.onload = () => setPdf({ base64: String(r.result), nome: file.name });
    r.readAsDataURL(file);
  }

  // Escolher a área já escreve o texto do serviço — mas só por cima de um
  // texto que também veio pronto (ou vazio): o que a pessoa escreveu fica.
  function escolherArea(valor: string) {
    const anterior = AREAS.find((a) => a.value === area)?.texto ?? '';
    const novo = AREAS.find((a) => a.value === valor)?.texto ?? '';
    setArea(valor);
    if (!objeto.trim() || objeto.trim() === anterior.trim()) setObjeto(novo);
  }

  async function melhorarTexto() {
    setMelhorando(true);
    try {
      const r = await sugerirTextoContratoAction({
        field: 'descricao',
        kind: 'SERVICO',
        direcao: tipo,
        partyName: nome,
        valor: valorNumero || 0,
        categoria: AREAS.find((a) => a.value === area)?.label ?? undefined,
        draft: objeto,
      });
      if (r.ok && r.text) setObjeto(r.text);
    } finally {
      setMelhorando(false);
    }
  }

  function podeAvancar(): string | null {
    if (passo === 1) {
      if (modelo === 'PROPRIO' && !pdf) return 'Anexe o PDF do contrato.';
      return null;
    }
    if (!nome.trim()) return `Informe o nome do ${quem.toLowerCase()}.`;
    if (!jaAssinado && usaOHub !== true && !/.+@.+\..+/.test(email)) return 'Informe o e-mail de quem assina pela outra parte.';
    if (modelo !== 'PROPRIO' && objeto.trim().length < 8) return 'Descreva o serviço em uma frase.';
    if (!(valorNumero > 0)) return 'Informe o valor mensal.';
    if (!fim || fim < inicio) return 'O fim precisa ser depois do início.';
    return null;
  }

  function avancar() {
    const problema = podeAvancar();
    if (problema) return setErro(problema);
    setErro(null);
    setPasso((p) => p + 1);
  }

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      const r = await criarContratoAction({
        modelo,
        tipo,
        categoria: area || undefined,
        parte: { nome, documento, endereco, email },
        objeto: objeto || (pdf?.nome.replace(/\.pdf$/i, '') ?? ''),
        titulo: modelo === 'PROPRIO' ? pdf?.nome.replace(/\.pdf$/i, '') : undefined,
        valor: valorNumero,
        diaVencimento: Math.min(31, Math.max(1, Number(dia) || 10)),
        formaPagamento: forma,
        inicio,
        fim,
        indice,
        emitirNota,
        pdf: pdf ?? undefined,
        jaAssinadoEm: modelo === 'PROPRIO' && jaAssinado ? assinadoEm : undefined,
      });
      if (!r.ok || !r.id) return setErro(r.message);
      if (r.assinatura === 'FORA') return onDone(r.message);
      // Já abre a assinatura: é o passo que faltava.
      setParaAssinar({
        id: r.id,
        title: modelo === 'PROPRIO' ? (pdf?.nome.replace(/\.pdf$/i, '') ?? 'Contrato') : objeto.slice(0, 80),
        partyName: nome,
        signatureMethod: r.assinatura ?? null,
        ownSignUrl: r.linkParaAssinar ?? null,
      });
    } catch {
      setErro('Não consegui criar o contrato. Tente de novo.');
    } finally {
      setCriando(false);
    }
  }

  if (paraAssinar) {
    return (
      <AssinarContrato
        contrato={paraAssinar}
        onClose={() => onDone('Contrato criado. Você pode assinar depois, em "Aguardando sua assinatura".')}
        onDone={onDone}
      />
    );
  }

  const PASSOS = ['Qual contrato', 'Com quem e quanto', 'Revisar e assinar'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-(--elev-3) dark:border-white/10"
      >
        {/* Cabeçalho: os três passos */}
        <div className="border-b border-black/5 px-6 pb-4 pt-5 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="rotulo text-ink-soft">Novo contrato · passo {passo} de 3</p>
              <h2 className="mt-1 text-xl font-light uppercase tracking-[0.06em] text-ink">{PASSOS[passo - 1]}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {PASSOS.map((p, i) => (
              <span key={p} className={`h-1 rounded-full ${i < passo ? 'bg-hexxa-forest dark:bg-hexxa-lime' : 'bg-black/10 dark:bg-white/10'}`} />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {/* ── PASSO 1 ─────────────────────────────────────────────── */}
          {passo === 1 && (
            <div className="space-y-3">
              {([
                ['Você recebe', ['CLIENTE', 'PROJETO', 'SOFTWARE']],
                ['Você paga', ['PJ', 'FORNECEDOR']],
                ['Outros', ['OUTRO']],
              ] as const).map(([grupo, lista]) => (
                <div key={grupo} className="space-y-2">
                  <p className="rotulo pt-2 text-ink-soft">{grupo}</p>
                  {lista.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModelo(m)}
                      className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-5 py-3.5 text-left transition-colors ${
                        modelo === m ? 'border-hexxa-forest bg-hexxa-forest/[0.04] dark:border-hexxa-lime dark:bg-hexxa-lime/[0.06]' : 'border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink">{MODELOS[m].rotulo}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{MODELOS[m].resumo}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setModelo('PROPRIO')}
                className={`flex w-full items-start justify-between gap-4 rounded-2xl border border-dashed px-5 py-4 text-left transition-colors ${
                  modelo === 'PROPRIO' ? 'border-hexxa-forest dark:border-hexxa-lime' : 'border-black/15 hover:border-black/30 dark:border-white/15'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">Já tenho o contrato (PDF)</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">Suba o seu arquivo para assinar aqui — ou registre um já assinado.</span>
                </span>
                <FileUp className="h-4 w-4 shrink-0 text-ink-soft" />
              </button>

              {escolheTipo && (
                <div className="flex gap-5 rounded-2xl bg-black/[0.02] px-5 py-4 text-sm dark:bg-white/[0.03]">
                  {(['ENTRADA', 'SAIDA'] as const).map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-2 text-ink">
                      <input type="radio" checked={tipoProprio === t} onChange={() => setTipoProprio(t)} />
                      {t === 'ENTRADA' ? 'Eu recebo (entrada)' : 'Eu pago (saída)'}
                    </label>
                  ))}
                </div>
              )}

              {modelo === 'PROPRIO' && (
                <div className="space-y-4 rounded-2xl bg-black/[0.02] p-5 dark:bg-white/[0.03]">
                  <input ref={arquivoRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => lerPdf(e.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-ink ring-1 ring-black/15 hover:ring-black/30 dark:ring-white/20"
                  >
                    <FileUp className="h-3.5 w-3.5" /> {pdf ? pdf.nome : 'Escolher PDF'}
                  </button>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={jaAssinado} onChange={(e) => setJaAssinado(e.target.checked)} />
                    Já está assinado pelas duas partes
                  </label>
                  {jaAssinado && (
                    <label className="block max-w-[200px]">
                      <Rotulo>Assinado em</Rotulo>
                      <input type="date" value={assinadoEm} onChange={(e) => setAssinadoEm(e.target.value)} className={campo} />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PASSO 2 ─────────────────────────────────────────────── */}
          {passo === 2 && (
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-sm font-semibold text-ink">{quem}</p>
                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <label className="block">
                    <Rotulo>CNPJ ou CPF</Rotulo>
                    <input value={documento} onChange={(e) => setDocumento(mascaraDoc(e.target.value))} inputMode="numeric" placeholder="00.000.000/0000-00" className={campo} />
                  </label>
                  <label className="block">
                    <Rotulo>Nome ou razão social</Rotulo>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
                  </label>
                </div>
                {consultando && <p className="text-xs text-ink-soft">Consultando a Receita…</p>}
                {avisoParte && <p className="text-xs text-ink-soft">{avisoParte}</p>}
                {usaOHub === true && (
                  <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>{nome}</strong> usa o Hub: o contrato aparece para ela na hora, para assinar, e as parcelas entram no financeiro dela
                    também.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <Rotulo>E-mail de quem assina {usaOHub ? '(opcional)' : ''}</Rotulo>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
                  </label>
                  <label className="block">
                    <Rotulo>Endereço</Rotulo>
                    <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={campo} />
                  </label>
                </div>
              </section>

              {modelo !== 'PROPRIO' && (
                <section className="space-y-3">
                  <p className="text-sm font-semibold text-ink">O serviço</p>
                  <label className="block max-w-[260px]">
                    <Rotulo>Área</Rotulo>
                    <select value={area} onChange={(e) => escolherArea(e.target.value)} className={campo}>
                      {AREAS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] text-ink-soft">
                    A área já traz um texto pronto e cláusulas próprias no contrato. Ajuste o texto ao seu caso — ou deixe como está.
                  </p>
                  <textarea
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    rows={3}
                    placeholder="Ex.: gestão das redes sociais, com 12 posts por mês e relatório mensal"
                    className={`${campo} resize-none`}
                  />
                  <button
                    type="button"
                    onClick={melhorarTexto}
                    disabled={melhorando || objeto.trim().length < 5}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
                  >
                    {melhorando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Deixar o texto mais formal
                  </button>
                </section>
              )}

              <section className="space-y-3">
                <p className="text-sm font-semibold text-ink">Valor e prazo</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <Rotulo>Valor por mês</Rotulo>
                    <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
                  </label>
                  <label className="block">
                    <Rotulo>Vence todo dia</Rotulo>
                    <input value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" className={campo} />
                  </label>
                  <label className="block">
                    <Rotulo>Reajuste anual</Rotulo>
                    <select value={indice} onChange={(e) => setIndice(e.target.value as IndiceDeReajuste)} className={campo}>
                      {(Object.keys(INDICES) as IndiceDeReajuste[]).map((i) => (
                        <option key={i} value={i}>
                          {INDICES[i]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <Rotulo>Começa em</Rotulo>
                    <input
                      type="date"
                      value={inicio}
                      onChange={(e) => {
                        setInicio(e.target.value);
                        if (e.target.value) setFim(maisUmAno(e.target.value));
                      }}
                      className={campo}
                    />
                  </label>
                  <label className="block">
                    <Rotulo>Termina em</Rotulo>
                    <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
                  </label>
                  <label className="block">
                    <Rotulo>Forma de pagamento</Rotulo>
                    <input value={forma} onChange={(e) => setForma(e.target.value)} className={campo} />
                  </label>
                </div>
                {tipo === 'ENTRADA' && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={emitirNota} onChange={(e) => setEmitirNota(e.target.checked)} />
                    Emitir a nota fiscal automaticamente todo mês
                  </label>
                )}
              </section>
            </div>
          )}

          {/* ── PASSO 3 ─────────────────────────────────────────────── */}
          {passo === 3 && (
            <div className="space-y-6">
              <dl className="divide-y divide-black/5 border-y border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
                {[
                  ['Contrato', modelo === 'PROPRIO' ? `Seu PDF · ${pdf?.nome}` : MODELOS[modelo].rotulo],
                  [quem, `${nome}${documento ? ` · ${documento}` : ''}`],
                  modelo !== 'PROPRIO' ? ['Serviço', objeto] : null,
                  ['Valor', `${BRL.format(valorNumero || 0)} por mês, todo dia ${dia}`],
                  ['Vigência', `${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`],
                  ['Reajuste', INDICES[indice]],
                ]
                  .filter(Boolean)
                  .map((l) => (
                    <div key={l![0]} className="grid grid-cols-[110px_1fr] gap-4 py-3">
                      <dt className="rotulo pt-0.5 text-ink-soft">{l![0]}</dt>
                      <dd className="text-ink">{l![1]}</dd>
                    </div>
                  ))}
              </dl>
              <p className="text-sm leading-relaxed text-ink-soft">
                {modelo === 'PROPRIO' && jaAssinado
                  ? 'O contrato entra ativo e as parcelas vão direto para o financeiro.'
                  : usaOHub
                    ? `Você assina agora, aqui mesmo. ${nome} recebe o aviso no Hub para assinar. Com as duas assinaturas, as parcelas entram no financeiro de cada um.`
                    : `Você assina agora, aqui mesmo. ${nome} recebe o contrato em ${email} para assinar. Com as duas assinaturas, as parcelas entram no seu financeiro.`}
              </p>
              {modelo !== 'PROPRIO' && (
                <p className="text-[11px] leading-relaxed text-ink-soft">
                  Modelo com cláusulas de objeto, vigência, pagamento, reajuste, {modelo === 'PJ' ? 'autonomia (sem vínculo de emprego), propriedade intelectual, ' : ''}
                  confidencialidade e LGPD, rescisão e assinatura eletrônica. Revise antes de assinar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 border-t border-black/5 px-6 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => (passo === 1 ? onClose() : setPasso((p) => p - 1))}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {passo === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <div className="flex items-center gap-3">
            {erro && <p className="max-w-[260px] text-right text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
            {passo < 3 ? (
              <button type="button" onClick={avancar} className="rounded-full bg-hexxa-forest px-6 py-2.5 text-xs font-bold text-hexxa-lime dark:bg-hexxa-lime dark:text-hexxa-forest">
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={criar}
                disabled={criando}
                className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-6 py-2.5 text-xs font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
              >
                {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {modelo === 'PROPRIO' && jaAssinado ? 'Registrar contrato' : 'Criar e assinar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
