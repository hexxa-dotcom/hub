'use client';

import { useState } from 'react';
import { AlertTriangle, X, CheckCircle2, Upload, Plus } from 'lucide-react';

type Cert = { tipo: 'A1' | 'A3'; validade: string; titular: string };

const field =
  'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

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
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-xs sm:text-sm text-red-800 dark:text-red-300 font-bold">
            Certificado vence em <strong>{dias} dia{dias !== 1 ? 's' : ''}</strong>! Renove com urgência para evitar interrupção nas emissões.
          </p>
        </div>
      )}
      {alertLevel === 'warn' && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-bold">
            Certificado vence em <strong>{dias} dias</strong>. Programe a renovação.
          </p>
        </div>
      )}

      {!cert && !editing && (
        <div className="py-2 space-y-4">
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C]">Nenhum certificado cadastrado. Adicione para receber alertas automáticos de vencimento.</p>
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
            <Plus className="h-4 w-4" /> Adicionar Certificado
          </button>
        </div>
      )}

      {cert && !editing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Tipo</span>
              <p className="font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3] mt-0.5">{cert.tipo}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Titular</span>
              <p className="font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3] mt-0.5 truncate">{cert.titular}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Vencimento</span>
              <p className="font-serif text-base font-bold text-[#231F20] dark:text-[#FEFDF3] mt-0.5">{new Date(cert.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E6A61] dark:text-[#A8A49C]">Status</span>
              <p className="font-serif text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {dias !== null && dias > 0 ? `Válido (${dias}d)` : dias === 0 ? 'Vence hoje!' : 'Vencido'}
              </p>
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={() => { setForm(cert); setEditing(true); }}
              className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 transition-all">
              Atualizar Dados
            </button>
            <button type="button" onClick={() => setCert(null)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-all">
              <X className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-4 max-w-lg">
          <div>
            <p className={lbl}>Tipo de Certificado</p>
            <div className="mt-1.5 flex gap-2">
              {(['A1', 'A3'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${form.tipo === t ? 'bg-[#1E3328] text-[#DFFFAE]' : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={lbl}>Titular (Nome no Certificado)</p>
            <input value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))}
              placeholder="Razão social ou nome do responsável legal"
              className={field} />
          </div>
          <div>
            <p className={lbl}>Data de Vencimento</p>
            <input type="date" value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))}
              className={field} />
          </div>
          
          {form.tipo === 'A1' && (
            <div>
              <p className={lbl}>Arquivo do Certificado (.pfx / .p12)</p>
              <div className="mt-1.5 flex justify-center rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-[#FEFDF3] dark:bg-[#121614] px-6 py-8 hover:border-[#1E3328] transition-colors cursor-pointer">
                <div className="text-center space-y-1">
                  <Upload className="h-6 w-6 mx-auto text-[#2F4A3C] dark:text-[#DFFFAE]" />
                  <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Clique para selecionar o arquivo .pfx</p>
                  <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">ou arraste o arquivo para esta área</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={salvar}
              className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
              Salvar Certificado
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2.5 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

