'use client';

import { useActionState } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { requestOtpAction, type AuthArea, type RequestOtpState } from './actions';

const initialState: RequestOtpState = { ok: true, message: '' };

export function EmailForm({ area, next }: { area: AuthArea; next: string }) {
  const [state, formAction, pending] = useActionState(requestOtpAction, initialState);

  return (
    <AuthLayout
      type={area}
      title={area === 'contador' ? 'Área do Contador' : 'Acesse seu Hub'}
      subtitle="Digite seu e-mail — enviamos um código de 6 dígitos pra você entrar"
    >
      <form action={formAction} className="w-full max-w-xs space-y-4">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="voce@empresa.com.br"
          disabled={pending}
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-center text-base text-[#FEFDF3] placeholder:text-white/40 outline-none focus:border-[#DFFFAE] focus:ring-2 focus:ring-[#DFFFAE]/30 disabled:opacity-50"
        />
        {!state.ok && state.message && (
          <p className="text-center text-sm text-red-300">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-[#DFFFAE] px-4 py-3.5 text-sm font-bold text-[#1E3328] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    </AuthLayout>
  );
}
