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
  ISSUED:   { label: 'Autorizada', cls: 'bg-green-100 text-green-700' },
  CANCELED: { label: 'Cancelada',  cls: 'bg-red-100 text-red-600' },
  ERROR:    { label: 'Erro',       cls: 'bg-red-100 text-red-600' },
};

// ── input helpers ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300';

// ── Form component ────────────────────────────────────────────────────────────

const initial: EmitState = { ok: false, message: '' };

export function NfseForm({ notas }: { notas: ServiceInvoiceRecord[] }) {
  const [state, action, pending] = useActionState(emitNfseAction, initial);

  const [doc, setDoc] = useState('');
  const [valor, setValor] = useState('');
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Reset on success
  const submitted = state.ok && state.status === 'ISSUED';

  return (
    <div className="space-y-6">
      {/* ── Formulário de emissão ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-surface-card shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Emitir nova NFSe</h2>
          <p className="mt-0.5 text-xs text-slate-500">Preencha os dados do tomador e do serviço prestado</p>
        </div>

        <form action={action} className="p-6 space-y-6">
          {/* Tomador */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tomador do serviço
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nome / Razão social <span className="text-red-500">*</span></label>
                <input
                  name="customerName"
                  required
                  placeholder="Empresa Cliente LTDA"
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>CPF / CNPJ <span className="text-red-500">*</span></label>
                <input
                  name="customerDocument"
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value={doc}
                  onChange={e => setDoc(fmtDoc(e.target.value))}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>E-mail do tomador <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
                <input
                  name="customerEmail"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  className={`mt-1 ${inputCls}`}
                />
              </div>

              {/* Reter ISS */}
              <div className="sm:col-span-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="retainIss" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    O ISSQN será retido na fonte pelo tomador
                  </span>
                </label>
                <p className="mt-1 text-xs text-slate-500 ml-6">
                  Se marcado, você <strong>deve</strong> preencher o endereço do tomador abaixo.
                </p>
              </div>

              {/* Endereço Tomador */}
              <div className="sm:col-span-2">
                <p className="mt-4 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Endereço do tomador (Obrigatório se ISS retido)
                </p>
              </div>
              <div>
                <label className={labelCls}>CEP</label>
                <input name="cep" placeholder="00000-000" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Código IBGE do Município</label>
                <input name="cMun" placeholder="Ex: 4211306 (Navegantes)" className={`mt-1 ${inputCls}`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Logradouro</label>
                <input name="logradouro" placeholder="Rua / Avenida" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Número</label>
                <input name="numero" placeholder="123" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Complemento</label>
                <input name="complemento" placeholder="Sala 03" className={`mt-1 ${inputCls}`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Bairro</label>
                <input name="bairro" placeholder="Centro" className={`mt-1 ${inputCls}`} />
              </div>
            </div>
          </div>

          {/* Serviço */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Serviço prestado
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Descrição do serviço <span className="text-red-500">*</span></label>
                <input
                  name="serviceDescription"
                  required
                  placeholder="Ex.: Consultoria contábil mensal – março/2026"
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>Valor (R$) <span className="text-red-500">*</span></label>
                {/* hidden para o server action */}
                <input type="hidden" name="amount" value={parseBRL(valor)} />
                <input
                  required
                  inputMode="numeric"
                  placeholder="0,00"
                  value={valor}
                  onChange={e => setValor(fmtBRL(e.target.value))}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>Mês de referência <span className="text-red-500">*</span></label>
                <input
                  name="referenceMonth"
                  type="month"
                  required
                  defaultValue={currentMonth}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
            </div>
          </div>

          {/* Feedback */}
          {state.message && (
            <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
              state.ok
                ? state.status === 'ISSUING'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {state.ok
                ? state.status === 'ISSUING'
                  ? <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              }
              <div className="flex-1">
                <p>{state.message}</p>
                {state.ok && state.status === 'ISSUED' && state.nfseNumber && (
                  <p className="mt-0.5 text-xs opacity-80">
                    Consulte o DANFSE no portal gov.br com o número {state.nfseNumber}.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Campos marcados com <span className="text-red-500">*</span> são obrigatórios
            </p>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? 'Emitindo…' : 'Emitir NFS-e'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Lista de notas ────────────────────────────────────────────── */}
      <NotasList notas={notas} />
    </div>
  );
}

// ── Lista de notas recentes ───────────────────────────────────────────────────

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
    if (!confirm('Confirmar cancelamento desta nota?')) return;
    startTransition(async () => {
      const r = await cancelNfseAction(id, protocol);
      setFeedback(prev => ({ ...prev, [id]: r.message }));
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface-card shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Notas emitidas</h2>
      </div>

      {notas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
          <FileText className="h-8 w-8" />
          <p className="text-sm">Nenhuma nota emitida ainda.</p>
          <p className="text-xs">Preencha o formulário acima para emitir a primeira.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-6 py-3">Nº / Protocolo</th>
                <th className="px-4 py-3">Tomador</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {notas.map(n => {
                const cfg = STATUS_CFG[n.status] ?? STATUS_CFG.DRAFT!;
                return (
                  <tr key={n.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                      {n.nfseNumber ?? n.providerProtocol?.slice(0, 12) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {(n as unknown as { customerName?: string }).customerName ?? '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-400">
                      {n.serviceDescription}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{n.referenceMonth}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}>
                        {n.status === 'ISSUING' && <Clock className="h-3 w-3" />}
                        {cfg.label}
                      </span>
                      {feedback[n.id] && (
                        <p className="mt-1 text-xs text-slate-400">{feedback[n.id]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {BRL.format(n.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {n.status === 'ISSUED' && (
                          <>
                            <a
                              href={`https://adn.nfse.gov.br/danfse/${n.providerProtocol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir DANFSE"
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => doCancel(n.id, n.providerProtocol ?? '')}
                              disabled={isPending}
                              title="Cancelar nota"
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-900/20"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {n.status === 'ISSUING' && n.providerProtocol && (
                          <button
                            onClick={() => doRefresh(n.id, n.providerProtocol!)}
                            disabled={isPending}
                            title="Atualizar status"
                            className="rounded-xl p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 dark:hover:bg-amber-900/20"
                          >
                            <Clock className="h-4 w-4" />
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
