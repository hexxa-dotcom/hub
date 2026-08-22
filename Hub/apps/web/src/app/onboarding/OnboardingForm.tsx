'use client';

import { useActionState, useState } from 'react';
import { Buildings, Spinner, ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { completeOnboardingAction, type OnboardingState } from './actions';

const initialState: OnboardingState = { ok: true, message: '' };

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function OnboardingForm({ companyName }: { companyName: string }) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, initialState);
  const [cnpj, setCnpj] = useState('');
  const [preview, setPreview] = useState<{ razaoSocial: string; municipio: string | null } | null>(null);
  const [consultando, setConsultando] = useState(false);

  // Preview automático: ao completar 14 dígitos, mostra a razão social encontrada.
  async function handleChange(v: string) {
    const masked = maskCnpj(v);
    setCnpj(masked);
    const digits = masked.replace(/\D/g, '');
    if (digits.length === 14) {
      setConsultando(true);
      setPreview(null);
      try {
        const res = await fetch(`/api/cnpj/${digits}`);
        if (res.ok) {
          const d = await res.json();
          setPreview({ razaoSocial: d.razaoSocial, municipio: d.municipio ?? null });
        }
      } catch {
        // preview é cortesia — a validação real acontece no submit
      } finally {
        setConsultando(false);
      }
    } else {
      setPreview(null);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl">
          <Buildings className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">
          Bem-vindo ao Hexx Hub
        </h1>
        <p className="text-sm text-white/75">
          Informe o CNPJ de <strong>{companyName}</strong> — buscamos os dados na Receita
          e preenchemos o cadastro da empresa e a base fiscal para você.
        </p>
      </div>

      <div className="rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-white/10">
        <form action={formAction} className="space-y-4">
          {!state.ok && state.message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {state.message}
            </div>
          )}

          <div>
            <label htmlFor="cnpj" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              CNPJ da empresa
            </label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              inputMode="numeric"
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => handleChange(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {consultando && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="h-4 w-4 animate-spin" /> Consultando a Receita…
            </p>
          )}
          {preview?.razaoSocial && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{preview.razaoSocial}</strong>
                {preview.municipio ? ` — ${preview.municipio}` : ''}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending || cnpj.replace(/\D/g, '').length !== 14}
            className="group mt-2 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 font-medium text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Spinner className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Configurar minha empresa
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/60">
        Você poderá revisar e completar os dados depois em Configurações.
      </p>
    </div>
  );
}
