'use client';

import { useState, useEffect, useActionState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Receipt, Sparkles, FileText, Download } from 'lucide-react';
import { emitNfseAction, type EmitState } from '../nfse/actions';
import { getQuickNfseContext, getLastInvoiceForCustomer, type QuickNfseCustomer, type QuickNfseProfile } from './quickNfseActions';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const field =
  'mt-1 w-full rounded-2xl bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-caption font-bold text-ink-soft uppercase tracking-wider';

const emitInitial: EmitState = { ok: false, message: '' };

export function QuickNfseForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(emitNfseAction, emitInitial);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<QuickNfseCustomer[]>([]);
  const [profiles, setProfiles] = useState<QuickNfseProfile[]>([]);
  const [taxRatePercent, setTaxRatePercent] = useState(0);

  const [selectedId, setSelectedId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [cusName, setCusName] = useState('');
  const [cusDoc, setCusDoc] = useState('');
  const [cusEmail, setCusEmail] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [amount, setAmount] = useState(0);
  const [autofillHint, setAutofillHint] = useState(false);
  const [competenciaDate, setCompetenciaDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    getQuickNfseContext().then((ctx) => {
      setCustomers(ctx.customers);
      setProfiles(ctx.profiles);
      setTaxRatePercent(ctx.taxRatePercent);
      setLoading(false);
      // Só uma opção de serviço cadastrada: já deixa selecionada, mas o campo
      // continua visível e trocável (o cliente pode ter mais de um serviço).
      if (ctx.profiles.length === 1) {
        setProfileId(ctx.profiles[0]!.id);
      }
    });
  }, []);

  function handleProfileSelect(id: string) {
    setProfileId(id);
    const p = profiles.find((p) => p.id === id);
    // Só preenche a descrição com o padrão do serviço se o cliente ainda não
    // tiver escrito nada (não sobrescreve o que já veio do autofill da última nota).
    if (p?.defaultDescription && !serviceDesc.trim()) {
      setServiceDesc(p.defaultDescription);
    }
  }

  function handleClientSelect(id: string) {
    setSelectedId(id);
    setAutofillHint(false);
    const c = customers.find((c) => c.id === id);
    if (!c) {
      setCusName('');
      setCusDoc('');
      setCusEmail('');
      return;
    }
    setCusName(c.name);
    setCusDoc(c.document ?? '');
    setCusEmail(c.email ?? '');

    // Puxa a última nota emitida pra esse cliente — mesmo serviço, mesmo valor.
    getLastInvoiceForCustomer(id).then((last) => {
      if (last) {
        setServiceDesc(last.serviceDescription);
        setAmount(last.amount);
        setAutofillHint(true);
      }
    });
  }

  const previewTax = (amount * taxRatePercent) / 100;
  const previewNet = amount - previewTax;
  const submitted = state.ok && state.status === 'ISSUED';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin text-hexxa-green dark:text-hexxa-lime" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-card shadow-(--elev-1) p-6 text-center text-sm text-ink-soft">
        Cadastre um cliente primeiro em{' '}
        <a href="/relacionamento" className="font-bold text-hexxa-green dark:text-hexxa-lime underline">
          Relacionamento
        </a>{' '}
        pra emitir por aqui.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-card shadow-(--elev-1) p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-hexxa-green dark:text-hexxa-lime mb-2" />
          <p className="text-sm font-bold text-ink">{state.message}</p>
          {state.taxAmount != null && state.taxAmount > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Imposto estimado{state.taxRate != null ? ` (${pctFmt(state.taxRate)}%)` : ''}: <strong>{fmt(state.taxAmount)}</strong> · Líquido: <strong>{fmt(state.netAmount ?? 0)}</strong>
            </p>
          )}
        </div>
        {state.status === 'ISSUED' && state.providerProtocol && state.invoiceId && (
          <div className="flex gap-2">
            <a
              href={`/meu-negocio/notas/${state.invoiceId}/danfse`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-4 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all"
            >
              <FileText className="h-3.5 w-3.5" /> PDF (DANFSe)
            </a>
            <a
              href={`/api/nfse/${state.invoiceId}/xml`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) px-4 py-2.5 text-xs font-bold text-ink transition-all"
            >
              <Download className="h-3.5 w-3.5" /> XML
            </a>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.assign('/meu-negocio/notas')}
            className="flex-1 rounded-full border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-[#231F20] dark:text-[#F5F6F4] hover:bg-black/5"
          >
            Ver todas as notas
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2.5 text-xs font-bold text-[#DFFFAE]"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="customerName" value={cusName} />
      <input type="hidden" name="customerDocument" value={cusDoc} />
      <input type="hidden" name="customerEmail" value={cusEmail} />
      {profileId && <input type="hidden" name="profileId" value={profileId} />}

      <div>
        <label className={lbl}>Cliente *</label>
        <select
          value={selectedId}
          onChange={(e) => handleClientSelect(e.target.value)}
          required
          className={field}
        >
          <option value="">— Selecione —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {autofillHint && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#2F4A3C] dark:text-[#DFFFAE]">
            <Sparkles className="h-3 w-3" /> Preenchido com o serviço e valor da última nota emitida pra esse cliente.
          </p>
        )}
      </div>

      {profiles.length > 0 && (
        <div>
          <label className={lbl}>Serviço *</label>
          <select value={profileId} onChange={(e) => handleProfileSelect(e.target.value)} required className={field}>
            <option value="">— Selecione —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={lbl}>Descrição do serviço *</label>
        <textarea
          name="serviceDescription"
          required
          rows={3}
          value={serviceDesc}
          onChange={(e) => setServiceDesc(e.target.value)}
          placeholder="Ex.: Consultoria contábil mensal"
          className={field}
        />
      </div>

      <div>
        <label className={lbl}>Informações adicionais <span className="normal-case font-normal text-[#A8A49C]">(opcional)</span></label>
        <textarea
          name="additionalInfo"
          rows={2}
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="Alguma observação pra constar na nota"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Valor Total (R$) *</label>
          <input type="hidden" name="amount" value={amount || ''} />
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount || ''}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className={`${field} font-serif text-lg font-bold tabular text-hexxa-forest dark:text-hexxa-lime`}
          />
        </div>
        <div>
          <label className={lbl}>Competência *</label>
          <input
            name="competenciaDate"
            type="date"
            required
            value={competenciaDate}
            onChange={(e) => setCompetenciaDate(e.target.value)}
            className={field}
          />
        </div>
      </div>
      {amount > 0 && taxRatePercent > 0 && (
        <p className="-mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          Imposto estimado ({pctFmt(taxRatePercent)}%): <strong>{fmt(previewTax)}</strong> · Líquido: <strong>{fmt(previewNet)}</strong>
        </p>
      )}

      {state.message && !submitted && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-500/10 shadow-(--elev-inset) px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !selectedId || (profiles.length > 0 && !profileId)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-6 py-3 text-sm font-bold text-hexxa-lime shadow-(--elev-1) transition-transform hover:scale-[1.01] disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
        {pending ? 'Emitindo…' : 'Emitir NFSe'}
      </button>
    </form>
  );
}
