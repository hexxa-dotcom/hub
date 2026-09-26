'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Link2,
  CalendarCheck,
  CalendarDays,
  Percent,
  RotateCcw,
  FileText,
  QrCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Paperclip,
  X,
  Pencil,
} from 'lucide-react';
import type { ContractDetail } from '../actions';
import {
  atualizarAssinaturaAction,
  renovarContratoAction,
  cancelarContratoAction,
  marcarNfseEmitidaAction,
  adicionarPagamentoExtraAction,
} from '../actions';
import { reenviarParaAssinaturaAction } from '../unified-actions';
import { reajustarAction, indiceAction } from '../contratos-actions';
import { AssinarContrato } from '../AssinarContrato';
import { VerContrato } from '../VerContrato';
import { situacao } from '../ListaDeContratos';
import { INDICES } from '../modelos-info';
import { useEffect } from 'react';
import { STATUS_LABEL, STATUS_CLASS } from '../contract-status';
import { VerComprovante } from '@/components/ui/VerComprovante';
import { GeneratePixModal } from '@/components/ui/GeneratePixModal';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field =
  'w-full rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const PAYMENT_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.FC<{ className?: string }> }> = {
  PENDING: { label: 'Em aberto', cls: 'bg-status-warning/15 text-status-warning', icon: Clock },
  PAID: { label: 'Pago', cls: 'bg-status-success/15 text-status-success', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', cls: 'bg-status-danger/15 text-status-danger', icon: AlertTriangle },
  CANCELED: { label: 'Cancelado', cls: 'bg-surface-elevated text-ink-soft', icon: XCircle },
};

function InfoCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) border border-black/5 dark:border-white/5 p-4">
      <p className="rotulo text-ink-soft">{label}</p>
      <p className="mt-0.5 font-serif tabular font-bold text-base text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-ink-soft">{hint}</p>}
    </div>
  );
}

export function ContratoDetailClient({ detail }: { detail: ContractDetail }) {
  const router = useRouter();
  const c = detail.contract;
  const isEntrada = c.type === 'ENTRADA';

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingSigning, setEditingSigning] = useState(false);
  const [signingInput, setSigningInput] = useState(c.signingDate ?? '');

  const [showReajuste, setShowReajuste] = useState(false);
  const [reajustePct, setReajustePct] = useState('5');

  const [showNfse, setShowNfse] = useState(false);
  const [nfseInput, setNfseInput] = useState('');

  const [showPix, setShowPix] = useState(false);
  const [assinar, setAssinar] = useState(false);
  const [vendo, setVendo] = useState(false);
  const [indice, setIndice] = useState<{ percentual: number; ate: string } | null>(null);

  // O índice oficial dos últimos 12 meses, para sugerir o reajuste.
  useEffect(() => {
    if (c.status !== 'ATIVO' || c.adjustmentIndex === 'NENHUM') return;
    indiceAction(c.adjustmentIndex).then((r) => {
      setIndice(r);
      if (r) setReajustePct(String(r.percentual).replace('.', ','));
    });
  }, [c.status, c.adjustmentIndex]);

  const [showExtra, setShowExtra] = useState(false);
  const [extraDescricao, setExtraDescricao] = useState('');
  const [extraValor, setExtraValor] = useState('');
  const [extraData, setExtraData] = useState(new Date().toISOString().split('T')[0]!);

  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  }

  async function handleSalvarAssinatura() {
    setBusy(true);
    try {
      const res = await atualizarAssinaturaAction(c.id, signingInput);
      flash(res.message);
      setEditingSigning(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReajustar() {
    const pct = parseFloat(reajustePct.replace(',', '.')) || 0;
    if (pct <= 0) return;
    setBusy(true);
    try {
      const res = await reajustarAction(c.id, pct);
      flash(res.message);
      setShowReajuste(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRenovar() {
    setBusy(true);
    try {
      const res = await renovarContratoAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelar() {
    if (!confirm('Cancelar este vínculo? Os lançamentos futuros ainda pendentes serão cancelados.')) return;
    setBusy(true);
    try {
      const res = await cancelarContratoAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarcarNfse() {
    if (!nfseInput.trim()) return;
    setBusy(true);
    try {
      const res = await marcarNfseEmitidaAction(c.id, nfseInput.trim());
      flash(res.message);
      setShowNfse(false);
      setNfseInput('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdicionarExtra() {
    setBusy(true);
    try {
      const res = await adicionarPagamentoExtraAction({
        contractId: c.id,
        descricao: extraDescricao,
        valor: Number(extraValor.replace(',', '.')),
        dueDate: extraData,
      });
      flash(res.message);
      if (res.ok) {
        setShowExtra(false);
        setExtraDescricao('');
        setExtraValor('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerPdf() {
    setVendo(true);
  }

  async function handleReenviar() {
    setBusy(true);
    try {
      const res = await reenviarParaAssinaturaAction(c.id);
      flash(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totalPago = detail.payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalAberto = detail.payments.filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE').reduce((s, p) => s + p.amount, 0);

  const s = situacao(c);
  const minhas = detail.assinaturas.filter((a) => a.daMinhaEmpresa);
  const delas = detail.assinaturas.filter((a) => !a.daMinhaEmpresa);
  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const botao =
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-ink ring-1 ring-black/10 transition-colors hover:ring-black/25 disabled:opacity-50 dark:ring-white/15 dark:hover:ring-white/30';
  const reajusteEm = c.nextAdjustmentDate ? Math.round((Date.parse(`${c.nextAdjustmentDate}T12:00:00Z`) - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-12">
      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </div>
      )}

      {/* Em que pé está + o que fazer agora */}
      <section className="rounded-[28px] border border-white/70 bg-white/75 p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="rotulo text-ink-soft">{isEntrada ? 'Entrada · você recebe' : 'Saída · você paga'}</p>
            <p className="mt-2 font-serif text-3xl font-bold tabular text-ink">
              {BRL.format(c.value)}
              <span className="ml-1.5 font-sans text-sm font-normal text-ink-soft">por mês · todo dia {c.dueDay}</span>
            </p>
            <p className={`mt-2 text-sm font-medium ${s.tom === 'alerta' ? 'text-rose-600 dark:text-rose-400' : s.tom === 'atencao' ? 'text-amber-700 dark:text-amber-400' : 'text-ink-soft'}`}>
              {s.texto}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {c.meFaltaAssinar && (
              <button
                type="button"
                onClick={() => setAssinar(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-hexxa-lime dark:bg-hexxa-lime dark:text-hexxa-forest"
              >
                <Pencil className="h-3.5 w-3.5" /> Ler e assinar
              </button>
            )}
            {c.hasPdf && (
              <button type="button" onClick={handleVerPdf} className={botao}>
                <FileText className="h-3.5 w-3.5" /> Ver contrato
              </button>
            )}
            {c.status === 'AGUARDANDO_ASSINATURA' && c.signatureMethod !== 'HUB' && c.initiatedHere && (
              <button type="button" onClick={handleReenviar} disabled={busy} className={botao}>
                <RotateCcw className="h-3.5 w-3.5" /> Reenviar e-mail
              </button>
            )}
          </div>
        </div>

        <dl className="mt-8 grid gap-x-8 gap-y-5 border-t border-black/5 pt-6 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
          <div>
            <dt className="rotulo text-ink-soft">{isEntrada ? 'Cliente' : 'Contratado'}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{c.partyName}</dd>
            <dd className="text-xs text-ink-soft">
              {c.partyCnpj ?? ''}
              {c.linkedOnPlatform ? `${c.partyCnpj ? ' · ' : ''}usa a Hexx` : ''}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-ink-soft">Vigência</dt>
            <dd className="mt-1 text-sm text-ink">
              {fmtDate(c.startDate)} a {fmtDate(c.endDate)}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-ink-soft">Reajuste</dt>
            <dd className="mt-1 text-sm text-ink">{INDICES[c.adjustmentIndex]}</dd>
            {c.nextAdjustmentDate && c.adjustmentIndex !== 'NENHUM' && <dd className="text-xs text-ink-soft">próximo em {fmtDate(c.nextAdjustmentDate)}</dd>}
          </div>
          <div>
            <dt className="rotulo text-ink-soft">No financeiro</dt>
            <dd className="mt-1 text-sm text-ink">{BRL.format(totalPago)} pago</dd>
            <dd className="text-xs text-ink-soft">{BRL.format(totalAberto)} em aberto</dd>
          </div>
        </dl>
        {c.description && <p className="mt-6 border-t border-black/5 pt-5 text-sm leading-relaxed text-ink-soft dark:border-white/10">{c.description}</p>}
      </section>

      {/* Assinaturas */}
      <section className="space-y-4">
        <p className="rotulo text-ink-soft">Assinaturas</p>
        {c.signatureMethod === 'HUB' ? (
          <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
            {[
              { quem: 'Sua empresa', lista: minhas },
              { quem: c.partyName, lista: delas },
            ].map((p) => (
              <li key={p.quem} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{p.quem}</p>
                  {p.lista[0] ? (
                    <p className="text-xs text-ink-soft">
                      {p.lista[0].nome}
                      {p.lista[0].cpf ? ` · CPF ${p.lista[0].cpf}` : ''} · {quando(p.lista[0].em)}
                      {p.lista[0].ip ? ` · IP ${p.lista[0].ip}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-soft">Ainda não assinou</p>
                  )}
                </div>
                <span className={`text-xs font-semibold ${p.lista[0] ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {p.lista[0] ? 'Assinado na Hexx' : 'Pendente'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            {c.signatureMethod === 'FORA'
              ? `Assinado fora da Hexx${c.signingDate ? ` em ${fmtDate(c.signingDate)}` : ''}; o PDF assinado está anexado.`
              : c.signatureMethod === 'DOCUSEAL'
                ? c.status === 'ATIVO'
                  ? `Assinado pelas duas partes pelo DocuSeal${c.signingDate ? ` em ${fmtDate(c.signingDate)}` : ''}.`
                  : `Pelo DocuSeal: ${c.meFaltaAssinar ? 'falta a sua assinatura e' : 'sua empresa já assinou;'} ${c.partyName} recebeu por e-mail.`
                : c.signingDate
                  ? `Assinado em ${fmtDate(c.signingDate)}.`
                  : 'Sem registro de assinatura.'}
          </p>
        )}
        {c.verificationCode && (
          <p className="text-xs text-ink-soft">
            Código de verificação <span className="font-mono font-semibold text-ink">{c.verificationCode}</span> — impresso em todas as páginas do
            contrato.{' '}
            <a href={`/v/${c.verificationCode}`} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">
              Ver a página de conferência
            </a>
          </p>
        )}
        {detail.documentHash && (
          <p className="break-all font-mono text-[10px] text-ink-soft/70">Código do documento (SHA-256): {detail.documentHash}</p>
        )}
      </section>

      {/* Reajuste e renovação */}
      {c.status === 'ATIVO' && (
        <section className="space-y-4">
          <p className="rotulo text-ink-soft">Reajuste e renovação</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-black/5 p-6 dark:border-white/10">
              <p className="text-sm font-semibold text-ink">Reajustar o valor</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {c.adjustmentIndex === 'NENHUM'
                  ? 'Este contrato não tem índice. Você pode aplicar um percentual combinado.'
                  : indice
                    ? `${c.adjustmentIndex} acumulado em 12 meses (até ${indice.ate}): ${indice.percentual.toLocaleString('pt-BR')}%.${reajusteEm !== null ? (reajusteEm > 0 ? ` O reajuste vale a partir de ${fmtDate(c.nextAdjustmentDate)}.` : ' O reajuste já pode ser aplicado.') : ''}`
                    : `Buscando o ${c.adjustmentIndex} no Banco Central…`}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <input
                  value={reajustePct}
                  onChange={(e) => setReajustePct(e.target.value)}
                  inputMode="decimal"
                  className="w-24 border-b border-black/15 bg-transparent pb-1 text-right font-serif text-lg font-bold tabular text-ink outline-none dark:border-white/20"
                />
                <span className="text-sm text-ink-soft">%</span>
                <button type="button" onClick={handleReajustar} disabled={busy} className={botao}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Percent className="h-3.5 w-3.5" />} Aplicar
                </button>
              </div>
              <p className="mt-3 text-[11px] text-ink-soft">
                Muda o valor das próximas parcelas no financeiro{c.linkedOnPlatform ? ` — o seu e o de ${c.partyName}` : ''}.
              </p>
            </div>
            <div className="rounded-[28px] border border-black/5 p-6 dark:border-white/10">
              <p className="text-sm font-semibold text-ink">Renovar por mais 12 meses</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Estende a vigência até um ano depois de {fmtDate(c.endDate)} e lança as novas parcelas{c.linkedOnPlatform ? ' dos dois lados' : ''}.
              </p>
              <button type="button" onClick={handleRenovar} disabled={busy} className={`${botao} mt-4`}>
                <RotateCcw className="h-3.5 w-3.5" /> Renovar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Parcelas */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rotulo text-ink-soft">Parcelas no financeiro</p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-soft">
            {c.status === 'ATIVO' && isEntrada && (
              <>
                <button type="button" onClick={() => setShowPix(true)} className="inline-flex items-center gap-1.5 hover:text-ink">
                  <QrCode className="h-3.5 w-3.5" /> Cobrar por Pix
                </button>
                <button type="button" onClick={() => setShowNfse(true)} className="inline-flex items-center gap-1.5 hover:text-ink">
                  <FileText className="h-3.5 w-3.5" /> {c.lastNfseEmitted ? `Nota ${c.nfseNumber}` : 'Informar nota emitida'}
                </button>
              </>
            )}
            {c.status === 'ATIVO' && c.externalProviderId && (
              <button type="button" onClick={() => setShowExtra(true)} className="hover:text-ink">
                + Pagamento extra
              </button>
            )}
          </div>
        </div>
        {detail.payments.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-10 text-center text-sm text-ink-soft dark:border-white/10">
            {c.status === 'AGUARDANDO_ASSINATURA' ? 'As parcelas entram no financeiro quando as duas partes assinarem.' : 'Nenhuma parcela lançada.'}
          </p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
            {detail.payments.map((p) => {
              const st = PAYMENT_STATUS_CFG[p.status] ?? PAYMENT_STATUS_CFG.PENDING!;
              const atrasada = p.status === 'PENDING' && p.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-4 px-6 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">Vence {fmtDate(p.dueDate)}</p>
                    <p className="truncate text-xs text-ink-soft">{p.description}</p>
                  </div>
                  <span className={`text-xs font-semibold ${atrasada || p.status === 'OVERDUE' ? 'text-rose-600 dark:text-rose-400' : p.status === 'PAID' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink-soft'}`}>
                    {atrasada ? 'Vencida' : st.label}
                    {p.paidAt ? ` em ${fmtDate(p.paidAt)}` : ''}
                  </span>
                  <span className="w-28 text-right font-serif text-sm font-bold tabular text-ink">{BRL.format(p.amount)}</span>
                  {p.hasReceipt && (
                    <VerComprovante id={p.id} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft hover:text-ink">
                      <Paperclip className="h-3 w-3" /> Comprovante
                    </VerComprovante>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(c.status === 'ATIVO' || c.status === 'AGUARDANDO_ASSINATURA') && (
        <button type="button" onClick={handleCancelar} disabled={busy} className="text-xs font-semibold text-ink-soft underline-offset-4 hover:text-rose-600 hover:underline disabled:opacity-50">
          Encerrar este contrato
        </button>
      )}

      {vendo && <VerContrato id={c.id} titulo={c.title} onClose={() => setVendo(false)} />}

      {assinar && (
        <AssinarContrato
          contrato={c}
          onClose={() => setAssinar(false)}
          onDone={(m) => {
            setAssinar(false);
            flash(m);
            router.refresh();
          }}
        />
      )}

      {/* Modais */}
      {showExtra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/5 p-6 sm:p-8 card-finish space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="rotulo text-ink-soft flex items-center gap-2">
                Pagamento Extra (Plantão etc.)
              </h3>
              <button onClick={() => setShowExtra(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              Fica separado da regra automática de repasse ({c.repassePercent}%) — soma no total a pagar, mas aparece como extra.
            </p>
            <div>
              <label className={lbl}>Descrição *</label>
              <input value={extraDescricao} onChange={(e) => setExtraDescricao(e.target.value)} placeholder="Ex.: Plantão extra dia 15" className={`mt-1.5 ${field}`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl}>Valor (R$) *</label>
                <input value={extraValor} onChange={(e) => setExtraValor(e.target.value)} placeholder="0,00" className={`mt-1.5 ${field}`} />
              </div>
              <div>
                <label className={lbl}>Data *</label>
                <input type="date" value={extraData} onChange={(e) => setExtraData(e.target.value)} className={`mt-1.5 ${field}`} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdicionarExtra}
              disabled={busy || !extraDescricao.trim() || !extraValor.trim()}
              className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Lançar Pagamento Extra'}
            </button>
          </div>
        </div>
      )}

      {showNfse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface-card shadow-(--elev-3) border border-black/5 dark:border-white/5 p-6 sm:p-8 card-finish space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="rotulo text-ink-soft flex items-center gap-2">
                <FileText className="h-5 w-5 text-hexxa-green dark:text-hexxa-lime" /> Marcar NFSe como Emitida
              </h3>
              <button onClick={() => setShowNfse(false)} className="rounded-full p-1 text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              A emissão real acontece em <strong>Meu Negócio → Notas</strong>. Aqui você só informa o número da nota já emitida para vincular a este vínculo.
            </p>
            <div>
              <label className={lbl}>Número da NFSe emitida *</label>
              <input value={nfseInput} onChange={(e) => setNfseInput(e.target.value)} placeholder="Ex.: 000142" className={`mt-1.5 ${field}`} />
            </div>
            <button
              type="button"
              onClick={handleMarcarNfse}
              disabled={busy || !nfseInput.trim()}
              className="w-full rounded-full bg-hexxa-forest hover:brightness-110 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirmar Vínculo'}
            </button>
          </div>
        </div>
      )}

      {showPix && (
        <GeneratePixModal isOpen={showPix} onClose={() => setShowPix(false)} initialDescription={`Contrato: ${c.title}`} />
      )}

    </div>
  );
}
