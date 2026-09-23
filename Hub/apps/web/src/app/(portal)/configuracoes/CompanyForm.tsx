'use client';

import { useState, useRef, useCallback } from 'react';
import { updateCompanyAction } from './actions';
import {
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Globe,
  MessageSquare,
  Mail,
  Phone,
  Image as ImageIcon,
} from 'lucide-react';
import { Instagram, Linkedin } from '@/components/ui/SocialIcons';
import type { CnpjData } from '@/app/api/cnpj/[cnpj]/route';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';

const field =
  'mt-1.5 w-full rounded-2xl border border-black/5 dark:border-white/5 bg-surface-card shadow-(--elev-inset) px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all';
const lbl = 'text-xs font-bold text-ink-soft uppercase tracking-wide';

export function CompanyForm({ company }: { company: any }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url || null);
  const [logoInputVal, setLogoInputVal] = useState<string>(company.logo_url || '');

  const legalNameRef = useRef<HTMLInputElement>(null);
  const tradeNameRef = useRef<HTMLInputElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const neighborhoodRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const zipcodeRef = useRef<HTMLInputElement>(null);
  const cnpjInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setLogoPreview(result);
      setLogoInputVal(result);
    };
    reader.readAsDataURL(file);
  }

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
    formData.set('logoUrl', logoInputVal);
    try {
      await updateCompanyAction(formData);
      setMessage({ type: 'success', text: 'Dados cadastrais e canais atualizados com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Bloco 1: Identidade Visual & Logotipo ── */}
      <div className="space-y-4 rounded-3xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-serif font-bold text-sm text-ink">Logotipo da Empresa</h3>
            <p className="text-xs text-ink-soft">Exibido no painel da empresa, relatórios e documentos oficiais.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
          {logoPreview ? (
            <div className="h-24 w-24 rounded-2xl bg-white dark:bg-[#1A201C] p-2 border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain rounded-xl" />
            </div>
          ) : (
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#1E3328] to-[#2F4A3C] text-[#DFFFAE] flex items-center justify-center font-serif text-3xl font-black shrink-0 shadow-md">
              {(company.trade_name || company.legal_name || 'H')[0]?.toUpperCase()}
            </div>
          )}

          <div className="space-y-3 flex-1 w-full">
            <div>
              <label className={lbl}>URL do Logotipo</label>
              <input
                type="text"
                placeholder="https://suaempresa.com/logo.png ou escolha uma foto abaixo"
                value={logoInputVal.startsWith('data:') ? '(Arquivo de imagem selecionado)' : logoInputVal}
                onChange={(e) => {
                  setLogoInputVal(e.target.value);
                  setLogoPreview(e.target.value || null);
                }}
                className={field}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-1.5 text-xs font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer shadow-xs"
              >
                <Upload className="h-3.5 w-3.5 text-ink-soft" />
                <span>Escolher Imagem do Computador</span>
              </button>

              {logoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    setLogoInputVal('');
                  }}
                  className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer"
                >
                  Remover Logo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bloco 2: Dados Oficiais da Empresa ── */}
      <div className="space-y-4">
        <h3 className="font-serif font-bold text-sm text-ink flex items-center gap-2">
          <span>Dados Cadastrais Oficiais</span>
        </h3>

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
                className="h-4 w-4 rounded accent-hexxa-forest" 
              />
              <label htmlFor="useTradeName" className="text-xs text-ink-soft cursor-pointer">
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
                  <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                )}
                {lookupStatus === 'found' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {(lookupStatus === 'not_found' || lookupStatus === 'error') && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </span>
            </div>
          </div>
          <div>
            <label className={lbl}>Inscrição Municipal</label>
            <input
              name="municipalRegistration"
              defaultValue={company.municipal_registration || ''}
              placeholder="Opcional"
              className={field}
            />
          </div>
        </div>
      </div>

      {/* ── Bloco 3: Presença Digital, Redes Sociais & Contatos ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
            <Globe className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-serif font-bold text-sm text-ink">Presença Digital & Canais Oficiais</h3>
            <p className="text-xs text-ink-soft">Redes sociais, website e canais de contato visíveis no painel da empresa.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className={lbl}>Website Oficial</label>
            <div className="relative">
              <input
                name="website"
                defaultValue={company.website || ''}
                placeholder="https://suaempresa.com.br"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Instagram</label>
            <div className="relative">
              <input
                name="instagram"
                defaultValue={company.instagram || ''}
                placeholder="@suaempresa ou https://instagram.com/..."
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>LinkedIn</label>
            <div className="relative">
              <input
                name="linkedin"
                defaultValue={company.linkedin || ''}
                placeholder="https://linkedin.com/company/suaempresa"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>WhatsApp Comercial</label>
            <div className="relative">
              <input
                name="whatsapp"
                defaultValue={company.whatsapp || ''}
                placeholder="(47) 99999-9999"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>E-mail Oficial</label>
            <div className="relative">
              <input
                name="email"
                type="email"
                defaultValue={company.email || ''}
                placeholder="contato@suaempresa.com.br"
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Telefone Comercial</label>
            <div className="relative">
              <input
                name="phone"
                defaultValue={company.phone || ''}
                placeholder="(47) 3333-3333"
                className={field}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bloco 4: Endereço da Sede ── */}
      <div className="space-y-4 pt-2">
        <h3 className="font-serif font-bold text-sm text-ink">Endereço da Sede Oficial</h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <label className={lbl}>CEP</label>
            <input
              ref={zipcodeRef}
              name="zipcode"
              placeholder="00000-000"
              defaultValue={company.zipcode || ''}
              className={field}
            />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Logradouro</label>
            <input
              ref={addressLine1Ref}
              name="addressLine1"
              placeholder="Rua, Avenida..."
              defaultValue={company.address_line1 || ''}
              className={field}
            />
          </div>
          <div>
            <label className={lbl}>Número / Complemento</label>
            <input
              name="addressNumber"
              placeholder="123, Sala 101"
              defaultValue={company.address_number || ''}
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
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-black/5 dark:border-white/10">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-hexxa-forest hover:brightness-110 px-6 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all active:scale-95 disabled:opacity-70 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
        {message && (
          <span className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
