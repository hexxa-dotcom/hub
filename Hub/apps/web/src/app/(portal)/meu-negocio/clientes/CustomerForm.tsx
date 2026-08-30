'use client';

import { useActionState, useRef, useState, useCallback } from 'react';
import { Plus, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { addCustomerAction, type CustomerState } from './actions';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';

const initial: CustomerState = { ok: false, message: '' };
const field =
  'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

export function CustomerForm() {
  const [state, action, pending] = useActionState(addCustomerAction, initial);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);

  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const cepRef = useRef<HTMLInputElement>(null);
  const cidadeRef = useRef<HTMLInputElement>(null);
  const ufRef = useRef<HTMLSelectElement>(null);
  const cnpjInputRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const diaRef = useRef<HTMLSelectElement>(null);

  const fillForm = useCallback((data: CnpjData) => {
    if (nomeRef.current) nomeRef.current.value = data.razaoSocial;
    if (emailRef.current) emailRef.current.value = data.email ?? '';
    if (telefoneRef.current) telefoneRef.current.value = data.telefone ?? '';
    if (enderecoRef.current) enderecoRef.current.value = data.endereco ?? '';
    if (cepRef.current) cepRef.current.value = data.cep ?? '';
    if (cidadeRef.current) cidadeRef.current.value = data.municipio ?? '';
    if (ufRef.current && data.uf) ufRef.current.value = data.uf;
  }, []);

  const lookupCnpj = useCallback(
    async (rawCnpj: string) => {
      const doc = normalizeDocument(rawCnpj);
      if (doc.length !== 14) return; // CPF não tem lookup na Receita
      setLookupStatus('loading');
      setCnpjData(null);
      try {
        const res = await fetch(`/api/cnpj/${doc}`);
        if (!res.ok) {
          setLookupStatus('not_found');
          return;
        }
        const data: CnpjData = await res.json();
        setCnpjData(data);
        fillForm(data);
        setLookupStatus('found');
      } catch {
        setLookupStatus('error');
      }
    },
    [fillForm],
  );

  function handleCnpjInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const formatted = formatDocument(input.value);
    input.value = formatted;
    if (isCompleteDocument(formatted)) {
      lookupCnpj(formatted);
    } else {
      setLookupStatus('idle');
    }
  }

  return (
    <form action={action} className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 space-y-4 shadow-sm">
      <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">Adicionar Novo Cliente</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Tipo */}
        <div>
          <label className={lbl}>Tipo de Pessoa</label>
          <select name="tipo" defaultValue="PJ" className={field}>
            <option value="PJ">Pessoa Jurídica (CNPJ)</option>
            <option value="PF">Pessoa Física (CPF)</option>
          </select>
        </div>

        {/* CNPJ com lookup */}
        <div>
          <label className={lbl}>CNPJ / CPF</label>
          <div className="relative mt-1.5">
            <input
              ref={cnpjInputRef}
              name="documento"
              required
              placeholder="00.000.000/0001-00"
              onInput={handleCnpjInput}
              className={`${field} mt-0 pr-10`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
              {lookupStatus === 'loading' && (
                <Loader2 className="h-4 w-4 animate-spin text-[#6E6A61]" />
              )}
              {lookupStatus === 'found' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              {(lookupStatus === 'not_found' || lookupStatus === 'error') && (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              {lookupStatus === 'idle' && (
                <Search className="h-4 w-4 text-[#6E6A61]/40" />
              )}
            </span>
          </div>
          {lookupStatus === 'found' && cnpjData && (
            <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              ✓ Dados preenchidos automaticamente via Receita Federal
            </p>
          )}
          {lookupStatus === 'not_found' && (
            <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">CNPJ não encontrado na Receita Federal</p>
          )}
        </div>

        {/* Nome */}
        <div className="md:col-span-2">
          <label className={lbl}>Razão Social / Nome Completo</label>
          <input
            ref={nomeRef}
            name="nome"
            required
            placeholder="Preenchido automaticamente pelo CNPJ..."
            className={field}
          />
        </div>

        {/* E-mail */}
        <div>
          <label className={lbl}>E-mail</label>
          <input
            ref={emailRef}
            name="email"
            type="email"
            placeholder="contato@empresa.com"
            className={field}
          />
        </div>

        {/* Telefone */}
        <div>
          <label className={lbl}>Telefone / WhatsApp</label>
          <input
            ref={telefoneRef}
            name="telefone"
            placeholder="(11) 98765-4321"
            className={field}
          />
        </div>

        {/* Endereço */}
        <div className="md:col-span-2">
          <label className={lbl}>Endereço Completo</label>
          <input
            ref={enderecoRef}
            name="endereco"
            placeholder="Rua, número, complemento, bairro"
            className={field}
          />
        </div>

        {/* CEP + Cidade + UF */}
        <div>
          <label className={lbl}>CEP</label>
          <input ref={cepRef} name="cep" placeholder="00000-000" className={field} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={lbl}>Cidade</label>
            <input ref={cidadeRef} name="cidade" placeholder="São Paulo" className={field} />
          </div>
          <div>
            <label className={lbl}>UF</label>
            <select ref={ufRef} name="uf" className={field}>
              <option value="">—</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(
                (uf) => <option key={uf} value={uf}>{uf}</option>,
              )}
            </select>
          </div>
        </div>

        <div className="md:col-span-2 pt-3 border-t border-black/5 dark:border-white/10">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Cobrança e Contrato (Opcional)</h3>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Preencha se desejar criar uma assinatura recorrente no Asaas automaticamente.</p>
        </div>

        {/* Valor Mensalidade */}
        <div>
          <label className={lbl}>Valor Mensalidade (R$)</label>
          <input
            ref={valorRef}
            name="valorMensalidade"
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 199.90"
            className={field}
          />
        </div>

        {/* Dia de Vencimento */}
        <div>
          <label className={lbl}>Dia de Vencimento</label>
          <select ref={diaRef} name="diaVencimento" defaultValue="" className={field}>
            <option value="">—</option>
            {[5, 10, 15, 20, 25, 28].map(
              (dia) => <option key={dia} value={dia}>Dia {dia}</option>,
            )}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {pending ? 'Cadastrando…' : 'Cadastrar Cliente'}
      </button>

      {state.message && (
        <p
          className={`mt-3 rounded-2xl p-3 text-xs font-bold ${state.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

