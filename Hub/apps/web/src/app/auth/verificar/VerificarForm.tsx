'use client';

import { useRef, useState, useTransition } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { requestOtpAction, verifyOtpAction, type AuthArea } from '../actions';

export function VerificarForm({ area, email, next }: { area: AuthArea; email: string; next: string }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resending, startResendTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[i] = v;
    setDigits(nextDigits);
    setError(null);
    if (v && i < 5) inputs.current[i + 1]?.focus();
    if (nextDigits.every((d) => d)) submit(nextDigits.join(''));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function submit(code: string) {
    startTransition(async () => {
      const res = await verifyOtpAction(area, email, code, next);
      if (res && 'error' in res) {
        setError(res.error);
        setDigits(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    });
  }

  function resend() {
    startResendTransition(async () => {
      const form = new FormData();
      form.set('email', email);
      form.set('area', area);
      form.set('next', next);
      await requestOtpAction({ ok: true, message: '' }, form);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    });
  }

  return (
    <AuthLayout
      type={area}
      title="Digite o código"
      subtitle={`Enviamos um código de 6 dígitos para ${email}`}
    >
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-center gap-2 sm:gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              disabled={pending}
              autoFocus={i === 0}
              className="h-14 w-11 sm:h-16 sm:w-12 rounded-2xl border border-white/15 bg-white/5 text-center text-2xl font-bold text-[#FEFDF3] outline-none focus:border-[#DFFFAE] focus:ring-2 focus:ring-[#DFFFAE]/30 disabled:opacity-50"
            />
          ))}
        </div>
        {error && <p className="text-center text-sm text-red-300">{error}</p>}
        {pending && <p className="text-center text-xs text-white/50">Verificando…</p>}
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="w-full text-center text-xs text-white/50 hover:text-[#DFFFAE] transition-colors disabled:opacity-50"
        >
          {resending ? 'Reenviando…' : resent ? 'Código reenviado!' : 'Não recebeu? Reenviar código'}
        </button>
      </div>
    </AuthLayout>
  );
}
