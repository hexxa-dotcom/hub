'use client';

import { useState, useRef, useCallback } from 'react';
import { updateCompanyAction } from './actions';
import { Loader2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';

const field =
  'mt-1.5 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lbl = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide';

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
      const doc = normalizeDocument(rawCnpj);
      if (doc.length !== 14) return;
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    try {
      await updateCompanyAction(formData);
      setMessage({ type: 'success', text: 'Dados cadastrais atualizados com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={lbl}>Razão Social *</label>
          <input
            ref={legalNameRef}
            name="legalName"
            defaultValue={company.legal_name || ''}
            required
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Nome Fantasia</label>
          <input
            ref={tradeNameRef}
            name="tradeName"
            defaultValue={company.trade_name || ''}
            className={field}
          />
          <div className="mt-2.5 flex items-center gap-2">
            <input 
              type="checkbox" 
              name="useTradeName" 
              id="useTradeName"
              defaultChecked={company.use_trade_name}
              className="h-4 w-4 rounded accent-[#1E3328]" 
            />
            <label htmlFor="useTradeName" className="text-xs text-[#6E6A61] dark:text-[#A8A49C] cursor-pointer">
              Exibir nome fantasia no menu superior
            </label>
          </div>
        </div>
        <div>
          <label className={lbl}>CNPJ *</label>
          <div className="relative mt-1">
            <input
              ref={cnpjInputRef}
              name="cnpj"
              defaultValue={company.cnpj || ''}
              required
              placeholder="00.000.000/0001-00"
              onInput={handleCnpjInput}
              className={`${field} pr-10`}
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
              ✓ Dados preenchidos automaticamente da Receita Federal
            </p>
          )}
          {lookupStatus === 'not_found' && (
            <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">CNPJ não encontrado na Receita Federal</p>
          )}
        </div>
        <div>
          <label className={lbl}>Inscrição Municipal</label>
          <input
            name="municipalRegistration"
            defaultValue={company.municipal_registration || ''}
            className={field}
          />
        </div>
      </div>

      <h3 className="pt-4 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider border-t border-black/5 dark:border-white/10">Endereço da Sede</h3>
      
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className={lbl}>Rua / Logradouro</label>
          <input
            ref={addressLine1Ref}
            name="addressLine1"
            defaultValue={company.address_line1 || ''}
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Número</label>
          <input
            name="addressNumber"
            defaultValue={company.address_number || ''}
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>CEP</label>
          <input
            ref={zipcodeRef}
            name="zipcode"
            defaultValue={company.zipcode || ''}
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Bairro</label>
          <input
            ref={neighborhoodRef}
            name="neighborhood"
            defaultValue={company.neighborhood || ''}
            className={field}
          />
        </div>
        <div>
          <label className={lbl}>Cidade / UF</label>
          <div className="flex gap-2">
            <input
              ref={cityRef}
              name="city"
              placeholder="Cidade"
              defaultValue={company.city || ''}
              className={field}
            />
            <input
              ref={stateRef}
              name="state"
              placeholder="UF"
              maxLength={2}
              defaultValue={company.state || ''}
              className={`w-20 shrink-0 text-center uppercase ${field}`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-black/5 dark:border-white/10">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
        {message && (
          <span className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

