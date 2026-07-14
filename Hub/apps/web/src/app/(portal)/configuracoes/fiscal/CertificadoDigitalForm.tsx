'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Cert = { tipo: 'A1' | 'A3'; validade: string; titular: string };

export function CertificadoDigitalForm() {
  const [cert, setCert] = useState<Cert | null>(null);
  const [form, setForm] = useState<Cert>({ tipo: 'A1', validade: '', titular: '' });
  const [editing, setEditing] = useState(false);

  function salvar() {
    if (!form.validade || !form.titular) return;
    setCert(form);
    setEditing(false);
  }

  function diasParaVencer(iso: string) {
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  }

  const dias = cert ? diasParaVencer(cert.validade) : null;
  const alertLevel = dias === null ? null : dias <= 7 ? 'critical' : dias <= 15 ? 'warn' : null;

  return (
    <div>
      {alertLevel === 'critical' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-critical/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
          <p className="text-sm text-critical font-medium">
            Certificado vence em <strong>{dias} dia{dias !== 1 ? 's' : ''}</strong>! Renove com urgência para evitar interrupção nas emissões.
          </p>
        </div>
      )}
      {alertLevel === 'warn' && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-warn/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p className="text-sm text-warn">
            Certificado vence em <strong>{dias} dias</strong>. Programe a renovação.
          </p>
        </div>
      )}

      {!cert && !editing && (
        <div className="py-2 space-y-3">
          <p className="text-sm text-ink-soft">Nenhum certificado cadastrado. Adicione para receber alertas de vencimento.</p>
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            Adicionar certificado
          </button>
        </div>
      )}

      {cert && !editing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-line bg-surface-hover p-3">
              <span className="text-xs text-ink-soft">Tipo</span>
              <p className="text-sm font-semibold">{cert.tipo}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-hover p-3">
              <span className="text-xs text-ink-soft">Titular</span>
              <p className="text-sm font-semibold truncate">{cert.titular}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-hover p-3">
              <span className="text-xs text-ink-soft">Vencimento</span>
              <p className="text-sm font-semibold">{new Date(cert.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-hover p-3">
              <span className="text-xs text-ink-soft">Status</span>
              <p className="text-sm font-semibold">
                {dias !== null && dias > 0 ? `Válido (${dias} dias)` : dias === 0 ? 'Vence hoje!' : 'Vencido'}
              </p>
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button type="button" onClick={() => { setForm(cert); setEditing(true); }}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-hover transition-colors">
              Atualizar
            </button>
            <button type="button" onClick={() => setCert(null)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-critical hover:bg-critical/10 transition-colors">
              <X className="h-4 w-4" /> Remover
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-4 max-w-md">
          <div>
            <p className="text-xs font-medium text-ink-soft">Tipo</p>
            <div className="mt-1 flex gap-2">
              {(['A1', 'A3'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${form.tipo === t ? 'bg-brand-500 text-white' : 'border border-line text-ink-soft hover:bg-surface-hover'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-soft">Titular (nome no certificado)</p>
            <input value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))}
              placeholder="Razão social ou nome do responsável"
              className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-soft">Data de vencimento</p>
            <input type="date" value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20" />
          </div>
          
          {form.tipo === 'A1' && (
            <div>
              <p className="text-xs font-medium text-ink-soft">Arquivo do Certificado (.pfx)</p>
              <div className="mt-1 flex justify-center rounded-xl border border-dashed border-line px-6 py-6 hover:bg-surface-hover transition-colors cursor-pointer">
                <div className="text-center">
                  <p className="text-sm font-medium text-brand-600">Clique para fazer upload</p>
                  <p className="text-xs text-ink-soft mt-1">ou arraste o arquivo aqui</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={salvar}
              className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
              Salvar Certificado
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-xl border border-line px-6 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
