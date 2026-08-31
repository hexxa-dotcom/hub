'use client';

import { useActionState, useState, useTransition } from 'react';
import { Loader2, CheckCircle2, Clock, AlertTriangle, FileText, X } from 'lucide-react';
import { emitNfseAction, cancelNfseAction, refreshNfseStatusAction, type EmitState } from './actions';
import type { ServiceInvoiceRecord } from '@hexxa/core/ports';

// ── helpers ──────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtDoc(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function fmtBRL(raw: string) {
  const num = raw.replace(/\D/g, '');
  if (!num) return '';
  const cents = parseInt(num, 10);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function parseBRL(formatted: string) {
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: 'Rascunho',   cls: 'bg-slate-100 text-slate-600' },
  ISSUING:  { label: 'Em emissão', cls: 'bg-amber-100 text-amber-700' },
  ISSUED:   { label: 'Autorizada', cls: 'bg-emerald-100 text-emerald-800' },
  CANCELED: { label: 'Cancelada',  cls: 'bg-red-50 text-red-600' },
  ERROR:    { label: 'Erro',       cls: 'bg-red-50 text-red-600' },
};

// ── input helpers ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-transparent border-b border-slate-200 px-0 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-800 dark:text-white dark:focus:border-white';

const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1';

// ── Form component ────────────────────────────────────────────────────────────

const initial: EmitState = { ok: false, message: '' };

export function NfseForm({ notas }: { notas: ServiceInvoiceRecord[] }) {
  const [state, action, pending] = useActionState(emitNfseAction, initial);

  const [doc, setDoc] = useState('');
  const [valor, setValor] = useState('');
  const [retainIss, setRetainIss] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-12">
      {/* ── Formulário de emissão ─────────────────────────────────────── */}
      <section>
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Emitir Nota Fiscal</h1>
        </div>

        <form action={action} className="space-y-12">
          {/* O Valor (Signature Element) */}
          <div className="relative group">
            <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Qual o valor do serviço prestado?</label>
            <div className="flex items-baseline gap-2 border-b-2 border-slate-200 dark:border-slate-800 focus-within:border-emerald-600 dark:focus-within:border-emerald-400 transition-colors pb-2">
              <span className="text-4xl sm:text-6xl font-light text-slate-300 dark:text-slate-600 select-none">R$</span>
              <input type="hidden" name="amount" value={parseBRL(valor)} />
              <input
                required
                inputMode="numeric"
                placeholder="0,00"
                value={valor}
                onChange={e => setValor(fmtBRL(e.target.value))}
                className="w-full bg-transparent text-4xl sm:text-6xl font-medium tracking-tight text-slate-900 dark:text-white outline-none placeholder:text-slate-200 dark:placeholder:text-slate-800"
              />
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 pt-4">
            {/* Bloco 1: O Serviço */}
            <div className="space-y-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Detalhes do Serviço</h3>
              
              <div>
                <label className={labelCls}>Descrição da Nota <span className="text-red-400">*</span></label>
                <textarea
                  name="serviceDescription"
                  required
                  rows={3}
                  placeholder="Ex.: Consultoria em desenvolvimento de software referente ao mês de março."
                  className="w-full bg-transparent border-b border-slate-200 px-0 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-800 dark:text-white dark:focus:border-white resize-none"
                />
              </div>

              <div>
                <label className={labelCls}>Mês de Competência <span className="text-red-400">*</span></label>
                <input
                  name="referenceMonth"
                  type="month"
                  required
                  defaultValue={currentMonth}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Bloco 2: O Tomador */}
            <div className="space-y-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Dados do Cliente (Tomador)</h3>
              
              <div>
                <label className={labelCls}>CNPJ ou CPF <span className="text-red-400">*</span></label>
                <input
                  name="customerDocument"
                  required
                  inputMode="numeric"
                  placeholder="00.000.000/0001-00"
                  value={doc}
                  onChange={e => setDoc(fmtDoc(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Nome ou Razão Social <span className="text-red-400">*</span></label>
                <input
                  name="customerName"
                  required
                  placeholder="Empresa Cliente LTDA"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>E-mail <span className="font-normal opacity-50">(Para envio automático)</span></label>
                <input
                  name="customerEmail"
                  type="email"
                  placeholder="contato@cliente.com.br"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Endereço (Progressive Disclosure) */}
          <div className="space-y-6 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group w-fit">
              <div className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${retainIss ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-700 bg-transparent group-hover:border-slate-400'}`}>
                {retainIss && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
              <input 
                type="checkbox" 
                name="retainIss" 
                className="hidden" 
                checked={retainIss}
                onChange={(e) => setRetainIss(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Imposto Retido na Fonte (Tomador paga o ISS)
              </span>
            </label>

            {retainIss && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Endereço do tomador obrigatório
                </p>
                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className={labelCls}>CEP</label>
                    <input name="cep" placeholder="00000-000" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Logradouro</label>
                    <input name="logradouro" placeholder="Rua / Avenida" className={inputCls} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className={labelCls}>Número</label>
                    <input name="numero" placeholder="123" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Bairro</label>
                    <input name="bairro" placeholder="Centro" className={inputCls} />
                  </div>
                  <div className="sm:col-span-1">
                    <label className={labelCls}>Complemento</label>
                    <input name="complemento" placeholder="Sala 03" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Cód. IBGE do Município</label>
                    <input name="cMun" placeholder="Ex: 4211306" className={inputCls} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback */}
          {state.message && (
            <div className={`flex items-start gap-3 rounded-2xl px-6 py-4 text-sm font-medium ${
              state.ok
                ? state.status === 'ISSUING'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {state.ok
                ? state.status === 'ISSUING'
                  ? <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              }
              <div className="flex-1">
                <p>{state.message}</p>
                {state.ok && state.status === 'ISSUED' && state.nfseNumber && (
                  <p className="mt-1 text-xs opacity-80 font-normal">
                    Consulte o DANFSE no portal nacional com o número {state.nfseNumber}.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Verifique os dados com atenção antes de emitir.
            </p>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-white px-8 py-3.5 text-sm font-bold text-white dark:text-slate-900 shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? 'Processando Emissão...' : 'Emitir Nota Fiscal'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Extrato de Notas (Ledger) ────────────────────────────────────────────── */}
      <section className="pt-16">
        <NotasList notas={notas} />
      </section>
    </div>
  );
}

// ── Lista de notas recentes (Ledger Style) ───────────────────────────────────────────────────

function NotasList({ notas }: { notas: ServiceInvoiceRecord[] }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function doRefresh(id: string, protocol: string) {
    startTransition(async () => {
      const r = await refreshNfseStatusAction(id, protocol);
      setFeedback(prev => ({ ...prev, [id]: r.message }));
    });
  }

  function doCancel(id: string, protocol: string) {
    if (!confirm('Esta ação é irreversível. Cancelar a nota no portal nacional?')) return;
    startTransition(async () => {
      const r = await cancelNfseAction(id, protocol);
      setFeedback(prev => ({ ...prev, [id]: r.message }));
    });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">Histórico Recente</h2>

      {notas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="h-8 w-8 opacity-50" />
          <p className="text-sm font-medium">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {notas.map(n => {
                const cfg = STATUS_CFG[n.status] ?? STATUS_CFG.DRAFT!;
                return (
                  <tr key={n.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-6">
                      <div className="font-medium text-slate-900 dark:text-white mb-1">
                        {(n as unknown as { customerName?: string }).customerName ?? 'Cliente não identificado'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {n.nfseNumber ? `NF-e ${n.nfseNumber}` : (n.providerProtocol?.slice(0, 12) ?? 'Sem protocolo')}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 hidden sm:table-cell">
                      {n.referenceMonth}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                        {n.status === 'ISSUING' && <Clock className="h-3 w-3" />}
                        {cfg.label}
                      </span>
                      {feedback[n.id] && (
                        <p className="mt-1 text-xs text-slate-400">{feedback[n.id]}</p>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-slate-900 dark:text-white">
                      {BRL.format(n.amount)}
                    </td>
                    <td className="py-4 pl-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {n.status === 'ISSUED' && (
                          <>
                            <a
                              href={`https://adn.nfse.gov.br/danfse/${n.providerProtocol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1"
                            >
                              Ver PDF
                            </a>
                            <button
                              onClick={() => doCancel(n.id, n.providerProtocol ?? '')}
                              disabled={isPending}
                              className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 disabled:opacity-40"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {n.status === 'ISSUING' && n.providerProtocol && (
                          <button
                            onClick={() => doRefresh(n.id, n.providerProtocol!)}
                            disabled={isPending}
                            className="text-xs font-medium text-amber-600 hover:text-amber-700 px-2 py-1 disabled:opacity-40"
                          >
                            Atualizar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
