'use client';

import { useRef, useState, useTransition } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { verifyAccessCodeAction, type AccessArea } from './actions';

export function CodigoForm({ area, next }: { area: AccessArea; next: string }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError(null);
    if (v && i < 3) inputs.current[i + 1]?.focus();
    if (next.every(d => d)) submit(next.join(''));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function submit(code: string) {
    startTransition(async () => {
      const res = await verifyAccessCodeAction(area, code, next);
      if (res && 'error' in res) {
        setError(res.error);
        setDigits(['', '', '', '']);
        inputs.current[0]?.focus();
      }
    });
  }

  return (
    <AuthLayout
      type={area}
      title={area === 'contador' ? 'Área do Contador' : 'Acesso à Minha Empresa'}
      subtitle="Digite o código de acesso de 4 dígitos"
    >
      <div className="w-full max-w-xs space-y-4">
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              value={d}
              onChange={e => setDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              disabled={pending}
              autoFocus={i === 0}
              className="h-16 w-14 rounded-2xl border border-white/15 bg-white/5 text-center text-2xl font-bold text-[#FEFDF3] outline-none focus:border-[#DFFFAE] focus:ring-2 focus:ring-[#DFFFAE]/30 disabled:opacity-50"
            />
          ))}
        </div>
        {error && <p className="text-center text-sm text-red-300">{error}</p>}
        {pending && <p className="text-center text-xs text-white/50">Verificando…</p>}
      </div>
    </AuthLayout>
  );
}
