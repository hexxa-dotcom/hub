'use client';

import { useState, useRef, useCallback } from 'react';
import { updateCompanyAction } from './actions';
import { Spinner, MagnifyingGlass, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';

export function CompanyForm({ company }: { company: any }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);

  const legalNameRef = useRef<HTMLInputElement>(null);
  const tradeNameRef = useRef<HTMLInputElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const neighborhoodRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const zipcodeRef = useRef<HTMLInputElement>(null);
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
    if (legalNameRef.current) legalNameRef.current.value = data.razaoSocial;
    if (tradeNameRef.current && data.nomeFantasia) tradeNameRef.current.value = data.nomeFantasia;
    if (addressLine1Ref.current) addressLine1Ref.current.value = data.endereco ?? '';
    if (neighborhoodRef.current) neighborhoodRef.current.value = data.bairro ?? '';
    if (cityRef.current) cityRef.current.value = data.municipio ?? '';
    if (stateRef.current && data.uf) stateRef.current.value = data.uf;
    if (zipcodeRef.current) zipcodeRef.current.value = data.cep ?? '';
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    try {
      await updateCompanyAction(formData);
      setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-ink-soft">Razão Social *</label>
          <input
            ref={legalNameRef}
            name="legalName"
            defaultValue={company.legal_name || ''}
            required
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">Nome Fantasia</label>
          <input
            ref={tradeNameRef}
            name="tradeName"
            defaultValue={company.trade_name || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
          <div className="mt-3 flex items-center gap-2">
            <input 
              type="checkbox" 
              name="useTradeName" 
              id="useTradeName"
              defaultChecked={company.use_trade_name}
              className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500" 
            />
            <label htmlFor="useTradeName" className="text-xs text-ink-soft cursor-pointer">
              Exibir nome fantasia no menu superior
            </label>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">CNPJ *</label>
          <div className="relative mt-1">
            <input
              ref={cnpjInputRef}
              name="cnpj"
              defaultValue={company.cnpj || ''}
              required
              placeholder="00.000.000/0001-00"
              onInput={handleCnpjInput}
              className="w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card pr-9"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {lookupStatus === 'loading' && (
                <Spinner className="h-4 w-4 animate-spin text-ink-soft" />
              )}
              {lookupStatus === 'found' && (
                <CheckCircle className="h-4 w-4 text-ok" />
              )}
              {(lookupStatus === 'not_found' || lookupStatus === 'error') && (
                <WarningCircle className="h-4 w-4 text-warn" />
              )}
              {lookupStatus === 'idle' && (
                <MagnifyingGlass className="h-4 w-4 text-ink-soft/40" />
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
        <div>
          <label className="text-sm font-medium text-ink-soft">Inscrição Municipal</label>
          <input
            name="municipalRegistration"
            defaultValue={company.municipal_registration || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
      </div>

      <h3 className="pt-4 text-sm font-bold text-ink-soft uppercase tracking-wider">Endereço</h3>
      
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-ink-soft">Rua / Logradouro</label>
          <input
            ref={addressLine1Ref}
            name="addressLine1"
            defaultValue={company.address_line1 || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">Número</label>
          <input
            name="addressNumber"
            defaultValue={company.address_number || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">CEP</label>
          <input
            ref={zipcodeRef}
            name="zipcode"
            defaultValue={company.zipcode || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">Bairro</label>
          <input
            ref={neighborhoodRef}
            name="neighborhood"
            defaultValue={company.neighborhood || ''}
            className="mt-1 w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">Cidade / Estado</label>
          <div className="mt-1 flex gap-2">
            <input
              ref={cityRef}
              name="city"
              placeholder="Cidade"
              defaultValue={company.city || ''}
              className="w-full rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card"
            />
            <input
              ref={stateRef}
              name="state"
              placeholder="UF"
              maxLength={2}
              defaultValue={company.state || ''}
              className="w-16 shrink-0 rounded-xl border border-line bg-surface-hover px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-surface-card text-center uppercase"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-6 border-t border-line">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-70"
        >
          {loading ? <Spinner className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-ok' : 'text-critical'}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
