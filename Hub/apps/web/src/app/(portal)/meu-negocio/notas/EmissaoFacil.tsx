'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Loader2, MapPin, Mail, MessageCircle, Pencil } from 'lucide-react';
import { emitNfseAction, consultarCnpjAction, type EmitState } from '../nfse/actions';
import { ultimaNotaAction, agendarEmissaoAction, alterarAgendadaAction } from './emissao-actions';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto } from '@/components/ui/ListaEmColunas';
import type { EmissaoAgendada } from '@/lib/server/emissao-agendada';

/**
 * EMITIR NOTA — perguntas simples, ao contrário do Emissor Nacional.
 *
 * Para quem? Qual valor? Qual serviço? — o resto o sistema resolve (perfil
 * fiscal, município pelo CNPJ, imposto). Depois: para quem mandar a nota
 * (e-mail e WhatsApp, do cliente ou de outra pessoa) e o que fazer depois
 * desta (só esta, repetir todo mês, agendar a próxima). Antes de emitir, a
 * PRÉVIA mostra a nota inteira, com os dados e contatos do cliente.
 *
 * A emissão em si é sempre `emitirNota` (travas de duplicidade, CNPJ válido).
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.split('-').reverse().join('/');
const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const docFmt = (d: string) => {
  const n = d.replace(/\D/g, '');
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
};

const painel =
  'rounded-[28px] border border-white/60 bg-white/55 p-6 ring-1 ring-inset ring-white/40 backdrop-blur-2xl sm:p-7 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5';
const campo =
  'mt-1.5 w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-hexxa-forest/50 dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime/40';
const pergunta = 'text-sm font-semibold text-ink';
const principal =
  'inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-7 py-3 text-sm font-semibold text-hexxa-lime transition-opacity disabled:opacity-40 dark:bg-hexxa-lime dark:text-hexxa-forest';

type Endereco = { cep: string; cMun: string; logradouro: string; numero: string; complemento?: string; bairro: string; municipio: string; uf: string };
type Cliente = { id: string; name: string; document: string | null; email: string | null; phone: string | null; endereco: Record<string, string> | null };
type Perfil = { id: string; nome: string; itemListaServico: string; aliquotaIss: number | null; defaultDescription?: string | null };
type Depois = 'so' | 'mensal' | 'data';

export interface Prestador {
  nome: string;
  cnpj: string;
  cidade: string | null;
  uf: string | null;
  logradouro: string | null;
  numero: string | null;
}

/** Para abrir a emissão já preenchida (uma pendente, um cliente). */
export interface InicialDaEmissao {
  customerId?: string;
  documento?: string;
  nome?: string;
  email?: string;
  valor?: number;
  descricao?: string;
  /** A parcela de contrato que a nota vai faturar. */
  parcelaId?: string;
}

const mesQueVem = (hoje: string) => {
  const [y, m, d] = hoje.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m, Math.min(d, 28), 12)).toISOString().slice(0, 10);
};

export function EmissaoFacil({
  mode,
  customers,
  profiles,
  taxRatePercent,
  liberaEm,
  prestador,
  inicial,
}: {
  mode: 'gov' | 'mock';
  customers: Cliente[];
  profiles: Perfil[];
  taxRatePercent: number;
  /** Simples antes de novembro: só dá para agendar a partir desta data. */
  liberaEm: string | null;
  prestador: Prestador | null;
  inicial?: InicialDaEmissao | null;
}) {
  const [state, action, pending] = useActionState(emitNfseAction, { ok: false, message: '' } as EmitState);
  const [agendando, iniciar] = useTransition();
  const [msgAgenda, setMsgAgenda] = useState<{ ok: boolean; texto: string } | null>(null);
  // A prévia abre para emitir ou para agendar — o botão que a pessoa apertou.
  const [previa, setPrevia] = useState<false | 'emitir' | 'agendar'>(false);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const doCadastro = inicial?.customerId ? customers.find((c) => c.id === inicial.customerId) : undefined;
  const [clienteId, setClienteId] = useState(doCadastro?.id ?? '');
  const [doc, setDoc] = useState(doCadastro?.document ?? inicial?.documento ?? '');
  const [nome, setNome] = useState(doCadastro?.name ?? inicial?.nome ?? '');
  const [endereco, setEndereco] = useState<Endereco | null>((doCadastro?.endereco as Endereco | null) ?? null);
  const [buscando, setBuscando] = useState(false);

  const [valor, setValor] = useState(inicial?.valor ? inicial.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? (profiles.length === 1 ? profiles[0]!.defaultDescription ?? '' : ''));
  const [perfilId, setPerfilId] = useState(profiles[0]?.id ?? '');
  const [competencia, setCompetencia] = useState(hoje);
  const [reterIss, setReterIss] = useState(false);

  const [emails, setEmails] = useState(doCadastro?.email ?? inicial?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(doCadastro?.phone ?? '');
  const [porEmail, setPorEmail] = useState(true);
  const [porWhats, setPorWhats] = useState(Boolean(doCadastro?.phone));

  const [depois, setDepois] = useState<Depois>('so');
  const [depoisData, setDepoisData] = useState(liberaEm ?? mesQueVem(hoje));

  const numero = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  const imposto = (numero * taxRatePercent) / 100;
  const perfil = profiles.find((p) => p.id === perfilId) ?? profiles[0];
  /** Simples antes de novembro: emitir pela Hexx ainda não é possível — ver `LIBERA_SIMPLES`. */
  const bloqueada = Boolean(liberaEm);

  // Cliente da lista: contatos e endereço do cadastro, e a última nota dele repetida.
  async function escolherCliente(id: string) {
    setClienteId(id);
    const c = customers.find((x) => x.id === id);
    setNome(c?.name ?? '');
    setDoc(c?.document ?? '');
    setEmails(c?.email ?? '');
    setWhatsapp(c?.phone ?? '');
    setPorWhats(Boolean(c?.phone));
    setEndereco((c?.endereco as Endereco | null) ?? null);
    setPrevia(false);
    if (!id || inicial?.parcelaId) return;
    const u = await ultimaNotaAction(id);
    if (u) {
      setDescricao(u.descricao);
      setValor(u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      if (u.perfilId && profiles.some((p) => p.id === u.perfilId)) setPerfilId(u.perfilId);
    }
  }

  // CNPJ (digitado ou de uma pendente) sem endereço: a Receita completa.
  useEffect(() => {
    const d = doc.replace(/\D/g, '');
    if (endereco || d.length !== 14) return;
    let vivo = true;
    setBuscando(true);
    consultarCnpjAction(d)
      .then((r) => {
        if (!vivo || !r) return;
        // Na nota vale a razão social; o nome fantasia é só apelido.
        setNome((n) => n || r.razaoSocial || r.nomeFantasia || '');
        if (r.email) setEmails((e) => e || r.email!);
        if (r.telefone) setWhatsapp((w) => w || r.telefone!);
        if (r.endereco) setEndereco(r.endereco);
      })
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [doc, endereco]);

  useEffect(() => {
    if (state.ok) setPrevia(false);
  }, [state]);

  function agendarSo(dataFixa?: string) {
    iniciar(async () => {
      const r = await agendarEmissaoAction({
        customerId: clienteId || undefined,
        nome,
        documento: doc,
        email: emails.split(/[,;\s]+/)[0],
        perfilId,
        descricao,
        valor: numero,
        data: dataFixa ?? depoisData,
        repetir: !dataFixa && depois === 'mensal',
      });
      setMsgAgenda({ ok: r.ok, texto: r.mensagem });
      if (r.ok) setPrevia(false);
    });
  }

  const docOk = clienteId || doc.replace(/\D/g, '').length >= 11;
  // ISS retido pelo cliente: a nota exige o endereço dele.
  const pronto = Boolean(numero > 0 && descricao.trim() && docOk && nome.trim() && (!reterIss || endereco));
  const ok = msgAgenda ? msgAgenda.ok : state.ok;
  const mensagem = msgAgenda?.texto ?? state.message;

  return (
    <div className="space-y-6">
      {bloqueada ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-800 dark:text-amber-300">
          Para o Simples Nacional, a emissão pela Hexx começa em {br(liberaEm!)}. Até lá, emita no{' '}
          <a href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noreferrer" className="font-semibold underline">
            Emissor Nacional
          </a>{' '}
          — mas já dá para deixar as notas de novembro agendadas aqui.
        </p>
      ) : mode === 'mock' ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-800 dark:text-amber-300">
          Modo de teste: sem certificado digital, a nota é gravada aqui mas não vai ao governo.{' '}
          <Link href="/configuracoes/fiscal" className="font-semibold underline">
            Configurar
          </Link>
        </p>
      ) : null}

      <form
        action={action}
        onChange={() => {
          if (previa) setPrevia(false);
          setMsgAgenda(null);
        }}
        className="grid gap-4 lg:grid-cols-12"
      >
        {/* ── A nota ── */}
        <div className={`${painel} space-y-6 lg:col-span-7`}>
          <div>
            <p className={pergunta}>Para quem?</p>
            <select value={clienteId} onChange={(e) => escolherCliente(e.target.value)} className={campo} aria-label="Cliente">
              <option value="">Outro — digitar CPF ou CNPJ</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!clienteId && (
              <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <input value={doc} onChange={(e) => { setDoc(e.target.value); setEndereco(null); }} placeholder="CNPJ ou CPF" inputMode="numeric" className={campo} aria-label="CPF ou CNPJ" />
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={buscando ? 'Buscando na Receita…' : 'Nome ou razão social'} className={campo} aria-label="Nome" />
              </div>
            )}
            <EnderecoDoTomador endereco={endereco} onChange={setEndereco} />
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={reterIss} onChange={(e) => setReterIss(e.target.checked)} /> O cliente retém o ISS
              {reterIss && !endereco && <span className="font-semibold text-amber-700 dark:text-amber-400">— informe o endereço dele</span>}
            </label>
          </div>

          <div>
            <p className={pergunta}>Qual valor?</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-2xl text-ink-soft">R$</span>
              <input
                value={valor}
                onChange={(e) => {
                  const n = e.target.value.replace(/\D/g, '');
                  setValor(n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                }}
                inputMode="numeric"
                placeholder="0,00"
                className="w-full bg-transparent font-serif text-4xl font-bold tracking-tight tabular text-ink outline-none placeholder:text-ink-soft/30"
                aria-label="Valor"
              />
            </div>
            {numero > 0 && taxRatePercent > 0 && (
              <p className="text-xs text-ink-soft">
                Imposto estimado {BRL.format(imposto)} ({pct(taxRatePercent)}%) · sobra {BRL.format(numero - imposto)}
              </p>
            )}
          </div>

          <div>
            <p className={pergunta}>Qual serviço?</p>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex.: Consultoria em gestão financeira referente a outubro."
              className={`${campo} resize-none`}
              aria-label="Serviço"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
              {profiles.length > 1 ? (
                <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)} className="rounded-full border border-black/10 bg-transparent px-3 py-1.5 dark:border-white/15" aria-label="Perfil fiscal">
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — item {p.itemListaServico}
                    </option>
                  ))}
                </select>
              ) : perfil ? (
                <span>
                  {perfil.nome} · item {perfil.itemListaServico}
                </span>
              ) : (
                <Link href="/configuracoes/fiscal" className="font-semibold text-rose-600 underline">
                  Cadastre um perfil fiscal
                </Link>
              )}
              {(
                <label className="flex items-center gap-2">
                  competência
                  <input type="date" value={competencia} max={hoje} onChange={(e) => setCompetencia(e.target.value)} className="rounded-full border border-black/10 bg-transparent px-3 py-1 text-ink dark:border-white/15" />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* ── Envio e próximas ── */}
        <div className={`${painel} space-y-6 lg:col-span-5`}>
          <div>
            <p className={pergunta}>Enviar a nota para</p>
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={porEmail} onChange={(e) => setPorEmail(e.target.checked)} /> <Mail className="h-3.5 w-3.5" /> E-mail
            </label>
            {porEmail && <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="financeiro@cliente.com, outro@…" className={campo} aria-label="E-mails" />}
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={porWhats} onChange={(e) => setPorWhats(e.target.checked)} /> <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </label>
            {porWhats && <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(47) 99999-0000" inputMode="tel" className={campo} aria-label="WhatsApp" />}
            <p className="mt-2 text-[11px] text-ink-soft">
              O e-mail sai sozinho com o PDF. O WhatsApp abre a conversa com a mensagem pronta — é só enviar.
            </p>
          </div>

          <div>
            <p className={pergunta}>Depois desta</p>
            <div className="mt-2 space-y-2 text-sm text-ink">
              <label className="flex items-center gap-2">
                <input type="radio" checked={depois === 'so'} onChange={() => setDepois('so')} /> Só esta nota
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={depois === 'mensal'} onChange={() => setDepois('mensal')} /> Repetir todo mês, a partir de
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={depois === 'data'} onChange={() => setDepois('data')} /> Agendar a próxima para
              </label>
              {depois !== 'so' && (
                <input
                  type="date"
                  min={liberaEm && liberaEm > hoje ? liberaEm : hoje}
                  value={depoisData}
                  onChange={(e) => setDepoisData(e.target.value)}
                  className="ml-6 rounded-full border border-black/10 bg-transparent px-3 py-1.5 text-xs text-ink dark:border-white/15"
                  aria-label="Data"
                />
              )}
            </div>
          </div>
        </div>

        {/* Os campos que vão ao servidor */}
        <input type="hidden" name="customerId" value={clienteId} />
        <input type="hidden" name="customerName" value={nome} />
        <input type="hidden" name="customerDocument" value={doc} />
        <input type="hidden" name="customerEmail" value={emails.split(/[,;\s]+/)[0] ?? ''} />
        <input type="hidden" name="amount" value={numero || ''} />
        <input type="hidden" name="serviceDescription" value={descricao} />
        <input type="hidden" name="profileId" value={perfilId} />
        <input type="hidden" name="competenciaDate" value={competencia} />
        <input type="hidden" name="emails" value={porEmail ? emails : ''} />
        <input type="hidden" name="whatsapp" value={porWhats ? whatsapp : ''} />
        <input type="hidden" name="depois" value={depois} />
        {reterIss && <input type="hidden" name="retainIss" value="on" />}
        <input type="hidden" name="depoisData" value={depois === 'so' ? '' : depoisData} />
        {inicial?.parcelaId && <input type="hidden" name="parcelaId" value={inicial.parcelaId} />}
        {endereco &&
          (['cep', 'cMun', 'logradouro', 'numero', 'bairro', 'municipio', 'uf'] as const).map((k) => <input key={k} type="hidden" name={k} value={endereco[k] ?? ''} />)}
        {endereco?.complemento && <input type="hidden" name="complemento" value={endereco.complemento} />}
        {state.precisaConfirmar && <input type="hidden" name="confirmarDuplicada" value="1" />}

        {/* ── Prévia e confirmação ── */}
        <div className={`${painel} lg:col-span-12`}>
          {!previa ? (
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" disabled={!pronto} onClick={() => setPrevia('emitir')} className={principal}>
                Emitir nota{numero > 0 ? ` de ${BRL.format(numero)}` : ''}
              </button>
              <button
                type="button"
                disabled={!pronto}
                onClick={() => setPrevia('agendar')}
                className="rounded-full border border-black/15 px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/20"
              >
                Agendar em vez de emitir
              </button>
              {inicial?.parcelaId && <span className="text-xs text-ink-soft">A nota fatura a parcela do contrato — não cria outro valor a receber.</span>}
            </div>
          ) : (
            <Previa
              prestador={prestador}
              cliente={{ nome, documento: doc, endereco, emails: porEmail ? emails : '', whatsapp: porWhats ? whatsapp : '' }}
              servico={{ descricao, perfil }}
              valor={numero}
              imposto={imposto}
              taxa={taxRatePercent}
              competencia={previa === 'agendar' ? depoisData : competencia}
              depois={depois}
              depoisData={depoisData}
              soAgendar={previa === 'agendar'}
              acao={
                <div className="flex flex-wrap items-center gap-4">
                  {previa === 'agendar' ? (
                    <button type="button" onClick={() => agendarSo()} disabled={agendando} className={principal}>
                      {agendando && <Loader2 className="h-4 w-4 animate-spin" />}
                      {depois === 'mensal' ? 'Confirmar e agendar todo mês' : 'Confirmar e agendar'}
                    </button>
                  ) : bloqueada ? (
                    <>
                      <p className="w-full text-xs text-amber-700 dark:text-amber-400">
                        Para o Simples Nacional, a emissão pela Hexx libera em {br(liberaEm!)}. Até lá, emita no Emissor Nacional — a nota volta sozinha para
                        cá — ou deixe esta agendada.
                      </p>
                      <a href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noreferrer" className={principal}>
                        Emitir no Emissor Nacional
                      </a>
                      <button type="button" onClick={() => agendarSo(liberaEm!)} disabled={agendando} className="rounded-full border border-black/15 px-5 py-3 text-sm font-semibold text-ink dark:border-white/20">
                        Agendar para {br(liberaEm!)}
                      </button>
                    </>
                  ) : (
                    <button type="submit" disabled={pending} className={principal}>
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {pending ? 'Emitindo…' : state.precisaConfirmar ? 'Emitir mesmo assim' : `Confirmar e emitir ${BRL.format(numero)}`}
                    </button>
                  )}
                  <button type="button" onClick={() => setPrevia(false)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
              }
            />
          )}

          {mensagem && (
            <div className={`mt-4 flex flex-wrap items-start gap-3 text-sm ${ok ? 'text-emerald-700 dark:text-emerald-400' : state.precisaConfirmar && !msgAgenda ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
              <p className="flex items-start gap-2">
                {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {mensagem}
              </p>
              {state.ok && state.whatsappLink && !msgAgenda && (
                <a href={state.whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-1.5 text-xs font-semibold text-ink dark:border-white/20">
                  <MessageCircle className="h-3.5 w-3.5" /> Enviar pelo WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

/** A nota inteira, como vai sair — antes de ir ao governo. */
function Previa({
  prestador,
  cliente,
  servico,
  valor,
  imposto,
  taxa,
  competencia,
  depois,
  depoisData,
  soAgendar,
  acao,
}: {
  prestador: Prestador | null;
  cliente: { nome: string; documento: string; endereco: Endereco | null; emails: string; whatsapp: string };
  servico: { descricao: string; perfil?: Perfil };
  valor: number;
  imposto: number;
  taxa: number;
  competencia: string;
  depois: Depois;
  depoisData: string;
  soAgendar: boolean;
  acao: React.ReactNode;
}) {
  const linha = 'grid gap-1 border-t border-black/[0.06] py-3 sm:grid-cols-[9rem_minmax(0,1fr)] dark:border-white/[0.08]';
  const r = 'rotulo text-ink-soft';
  const avisos = [
    !cliente.endereco && cliente.documento.replace(/\D/g, '').length === 14 && 'O endereço do cliente não veio da Receita — confira o CNPJ.',
    !cliente.emails && !cliente.whatsapp && 'A nota não vai ser enviada a ninguém — ela fica aqui e no Emissor Nacional.',
    !cliente.endereco && 'Sem o endereço do cliente — o Emissor Nacional aceita, mas alguns municípios exigem.',
  ].filter(Boolean) as string[];
  return (
    <div>
      <p className="rotulo text-ink-soft">Prévia da nota</p>
      <div className="mt-3 rounded-2xl border border-dashed border-black/15 px-5 py-2 dark:border-white/15">
        <div className={linha}>
          <span className={r}>Prestador</span>
          <span className="text-sm text-ink">
            {prestador?.nome ?? '—'} · CNPJ {prestador ? docFmt(prestador.cnpj) : '—'}
            {prestador?.cidade ? <span className="block text-xs text-ink-soft">{[prestador.logradouro, prestador.numero].filter(Boolean).join(', ')}{prestador.logradouro ? ' — ' : ''}{prestador.cidade}/{prestador.uf}</span> : null}
          </span>
        </div>
        <div className={linha}>
          <span className={r}>Tomador</span>
          <span className="text-sm text-ink">
            {cliente.nome || '—'} · {cliente.documento.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} {docFmt(cliente.documento)}
            {cliente.endereco && (
              <span className="block text-xs text-ink-soft">
                {cliente.endereco.logradouro}, {cliente.endereco.numero}{cliente.endereco.complemento ? ` ${cliente.endereco.complemento}` : ''} — {cliente.endereco.bairro}, {cliente.endereco.municipio}/{cliente.endereco.uf} · CEP {cliente.endereco.cep}
              </span>
            )}
            {(cliente.emails || cliente.whatsapp) && (
              <span className="block text-xs text-ink-soft">{[cliente.emails, cliente.whatsapp && `WhatsApp ${cliente.whatsapp}`].filter(Boolean).join(' · ')}</span>
            )}
          </span>
        </div>
        <div className={linha}>
          <span className={r}>Serviço</span>
          <span className="text-sm text-ink">
            {servico.perfil ? <span className="block text-xs text-ink-soft">{servico.perfil.nome} · item {servico.perfil.itemListaServico} da LC 116</span> : null}
            {servico.descricao}
          </span>
        </div>
        <div className={linha}>
          <span className={r}>Valor</span>
          <span className="text-sm text-ink">
            <strong className="font-serif text-lg tabular">{BRL.format(valor)}</strong>
            <span className="block text-xs text-ink-soft">
              imposto estimado {BRL.format(imposto)} ({pct(taxa)}%) · sobra {BRL.format(valor - imposto)}
            </span>
          </span>
        </div>
        <div className={linha}>
          <span className={r}>{soAgendar ? 'Sai em' : 'Competência'}</span>
          <span className="text-sm text-ink">
            {br(competencia)}
            {depois === 'mensal' && <span className="block text-xs text-ink-soft">e depois todo dia {Math.min(28, Number(depoisData.slice(8, 10)))}</span>}
            {!soAgendar && depois === 'data' && <span className="block text-xs text-ink-soft">próxima agendada para {br(depoisData)}</span>}
          </span>
        </div>
      </div>
      {avisos.map((a) => (
        <p key={a} className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {a}
        </p>
      ))}
      <div className="mt-4">{acao}</div>
    </div>
  );
}

export function Agendadas({ itens }: { itens: EmissaoAgendada[] }) {
  const [pendente, iniciar] = useTransition();
  const fazer = (id: string, acao: 'pausar' | 'retomar' | 'pular' | 'excluir') => iniciar(() => alterarAgendadaAction(id, acao));
  return (
    <section className="space-y-4">
      <p className="rotulo text-ink-soft">Próximas emissões</p>
      <ListaEmColunas
        colunas={[
          { rotulo: 'Cliente', largura: 'minmax(0,1fr)' },
          { rotulo: 'Quando', largura: '9rem', soDesktop: true },
          { rotulo: 'Situação', largura: '8rem', soDesktop: true },
          { rotulo: 'Valor', largura: '8rem', alinhar: 'direita' },
        ]}
        itens={itens}
        chave={(a) => a.id}
        apagada={(a) => !a.ativa}
        alerta={(a) => Boolean(a.ultimoErro)}
        celulas={(a) => [
          <Titulo key="t" nome={a.cliente} apoio={a.descricao} />,
          <span key="q" className="text-xs text-ink-soft">
            {a.diaDoMes ? `todo dia ${a.diaDoMes}` : br(a.proximaData)}
            {a.diaDoMes && a.ativa ? <span className="block">próxima {br(a.proximaData)}</span> : null}
          </span>,
          <Situacao key="s" cor={a.ultimoErro ? 'bg-rose-500' : a.ativa ? 'bg-emerald-500' : 'bg-black/25 dark:bg-white/30'}>
            {a.ultimoErro ? 'Com erro' : a.ativa ? 'Agendada' : 'Pausada'}
          </Situacao>,
          <Valor key="v">{BRL.format(a.valor)}</Valor>,
        ]}
        detalhe={(a) => (
          <div className="space-y-3">
            {a.ultimoErro && <p className="text-xs text-rose-600 dark:text-rose-400">Última tentativa: {a.ultimoErro}</p>}
            <div className="flex flex-wrap gap-2">
              {a.ativa ? <BotaoDiscreto onClick={() => fazer(a.id, 'pausar')}>Pausar</BotaoDiscreto> : <BotaoDiscreto onClick={() => fazer(a.id, 'retomar')}>Retomar</BotaoDiscreto>}
              {a.diaDoMes && a.ativa && <BotaoDiscreto onClick={() => fazer(a.id, 'pular')}>Pular a próxima</BotaoDiscreto>}
              <BotaoDiscreto onClick={() => fazer(a.id, 'excluir')}>{pendente ? '…' : 'Excluir'}</BotaoDiscreto>
            </div>
          </div>
        )}
      />
    </section>
  );
}

/**
 * O endereço do tomador. Na NFS-e nacional ele é opcional para quem é do
 * Brasil — obrigatório quando o ISS é retido e em alguns municípios. Pelo
 * CNPJ ele vem da Receita; pelo CPF (ou para corrigir), abre aqui: o CEP
 * completa rua, bairro e município (com o código IBGE que a nota pede).
 */
function EnderecoDoTomador({ endereco, onChange }: { endereco: Endereco | null; onChange: (e: Endereco | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [e, setE] = useState<Endereco>(endereco ?? { cep: '', cMun: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '' });
  const [status, setStatus] = useState<'' | 'buscando' | 'erro'>('');
  const mini = 'w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-xs text-ink outline-none dark:border-white/10 dark:bg-white/5';

  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    setStatus('buscando');
    try {
      const r = await fetch(`/api/cep/${d}`);
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { logradouro: string; bairro: string; cidade: string; uf: string; codigoMunicipio: string };
      setE((x) => ({ ...x, cep: d, logradouro: j.logradouro || x.logradouro, bairro: j.bairro || x.bairro, municipio: j.cidade, uf: j.uf, cMun: j.codigoMunicipio }));
      setStatus('');
    } catch {
      setStatus('erro');
    }
  }

  if (!aberto) {
    return endereco ? (
      <p className="mt-2 flex flex-wrap items-start gap-1.5 text-xs text-ink-soft">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="font-semibold text-ink">Endereço</span> <span>(opcional)</span> ·
        {endereco.logradouro}, {endereco.numero} — {endereco.bairro}, {endereco.municipio}/{endereco.uf}
        <button type="button" onClick={() => { setE(endereco); setAberto(true); }} className="font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          editar
        </button>
      </p>
    ) : (
      <button type="button" onClick={() => setAberto(true)} className="mt-2 text-xs font-semibold text-ink-soft hover:text-ink">
        + Endereço do cliente <span className="font-normal">· opcional (exigido se o ISS for retido)</span>
      </button>
    );
  }
  const completo = e.cMun.length === 7 && e.logradouro && e.numero && e.bairro;
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-black/10 p-3 sm:grid-cols-6 dark:border-white/10">
      <input className={`${mini} sm:col-span-2`} placeholder="CEP" inputMode="numeric" value={e.cep} onChange={(x) => { setE({ ...e, cep: x.target.value }); buscarCep(x.target.value); }} aria-label="CEP" />
      <input className={`${mini} sm:col-span-4`} placeholder="Rua / avenida" value={e.logradouro} onChange={(x) => setE({ ...e, logradouro: x.target.value })} aria-label="Logradouro" />
      <input className={`${mini} sm:col-span-1`} placeholder="Nº" value={e.numero} onChange={(x) => setE({ ...e, numero: x.target.value })} aria-label="Número" />
      <input className={`${mini} sm:col-span-2`} placeholder="Complemento" value={e.complemento ?? ''} onChange={(x) => setE({ ...e, complemento: x.target.value })} aria-label="Complemento" />
      <input className={`${mini} sm:col-span-3`} placeholder="Bairro" value={e.bairro} onChange={(x) => setE({ ...e, bairro: x.target.value })} aria-label="Bairro" />
      <p className="text-[11px] text-ink-soft sm:col-span-6">
        {status === 'buscando' ? 'Buscando o CEP…' : status === 'erro' ? 'CEP não encontrado — confira os números.' : e.municipio ? `${e.municipio}/${e.uf} · IBGE ${e.cMun}` : 'Digite o CEP: cidade e código IBGE vêm sozinhos.'}
      </p>
      <div className="flex gap-3 sm:col-span-6">
        <button type="button" disabled={!completo} onClick={() => { onChange({ ...e, complemento: e.complemento || undefined }); setAberto(false); }} className="rounded-full bg-hexxa-forest px-4 py-1.5 text-xs font-semibold text-hexxa-lime disabled:opacity-40 dark:bg-hexxa-lime dark:text-hexxa-forest">
          Usar este endereço
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-ink-soft hover:text-ink">
          Cancelar
        </button>
        {endereco && (
          <button type="button" onClick={() => { onChange(null); setAberto(false); }} className="text-xs text-ink-soft hover:text-rose-600">
            Tirar o endereço
          </button>
        )}
      </div>
    </div>
  );
}
