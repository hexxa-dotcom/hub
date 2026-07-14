'use client';

import { useActionState, useRef, useState, useCallback } from 'react';
import { Plus, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { addCustomerAction, type CustomerState } from './actions';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';

const initial: CustomerState = { ok: false, message: '' };
const field =
  'mt-1 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors';
const lbl = 'text-xs font-medium text-ink-soft';

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

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

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
      const digits = rawCnpj.replace(/\D/g, '');
      if (digits.length !== 14) return;
      setLookupStatus('loading');
      setCnpjData(null);
      try {
        const res = await fetch(`/api/cnpj/${digits}`);
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
    const formatted = formatCnpj(input.value);
    input.value = formatted;
    if (formatted.replace(/\D/g, '').length === 14) {
      lookupCnpj(formatted);
    } else {
      setLookupStatus('idle');
    }
  }

  return (
    <form action={action} className="card-flat rounded-card p-5">
      <h2 className="text-lg font-semibold">Adicionar novo cliente</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Tipo */}
        <div>
          <label className={lbl}>Tipo de pessoa</label>
          <select name="tipo" defaultValue="PJ" className={field}>
            <option value="PJ">Pessoa Jurídica (CNPJ)</option>
            <option value="PF">Pessoa Física (CPF)</option>
          </select>
        </div>

        {/* CNPJ com lookup */}
        <div>
          <label className={lbl}>CNPJ / CPF</label>
          <div className="relative mt-1">
            <input
              ref={cnpjInputRef}
              name="documento"
              required
              placeholder="00.000.000/0001-00"
              onInput={handleCnpjInput}
              className={`${field} mt-0 pr-9`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {lookupStatus === 'loading' && (
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
              )}
              {lookupStatus === 'found' && (
                <CheckCircle2 className="h-4 w-4 text-ok" />
              )}
              {(lookupStatus === 'not_found' || lookupStatus === 'error') && (
                <AlertCircle className="h-4 w-4 text-warn" />
              )}
              {lookupStatus === 'idle' && (
                <Search className="h-4 w-4 text-ink-soft/40" />
              )}
            </span>
          </div>
          {lookupStatus === 'found' && cnpjData && (
            <p className="mt-1 text-[11px] text-ok">
              ✓ Dados preenchidos automaticamente
            </p>
          )}
          {lookupStatus === 'not_found' && (
            <p className="mt-1 text-[11px] text-warn">CNPJ não encontrado na Receita Federal</p>
          )}
        </div>

        {/* Nome */}
        <div className="md:col-span-2">
          <label className={lbl}>Razão Social / Nome</label>
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
            placeholder="email@empresa.com"
            className={field}
          />
        </div>

        {/* Telefone */}
        <div>
          <label className={lbl}>Telefone</label>
          <input
            ref={telefoneRef}
            name="telefone"
            placeholder="(11) 98765-4321"
            className={field}
          />
        </div>

        {/* Endereço */}
        <div className="md:col-span-2">
          <label className={lbl}>Endereço</label>
          <input
            ref={enderecoRef}
            name="endereco"
            placeholder="Rua, número, bairro"
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
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {pending ? 'Cadastrando…' : 'Cadastrar cliente'}
      </button>

      {state.message && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${state.ok ? 'bg-ok/10 text-ok' : 'bg-critical/10 text-critical'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
