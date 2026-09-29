'use client';

import { useRef, useState, useTransition } from 'react';
import type { ResultadoDoCodigo } from './actions';

/** Quatro casas de número. Confirma sozinho ao completar; `confirmar` pede a repetição. */
export function TecladoDoCodigo({
  enviar,
  confirmar = false,
}: {
  enviar: (codigo: string) => Promise<ResultadoDoCodigo>;
  confirmar?: boolean;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function limpar() {
    setDigits(['', '', '', '']);
    inputs.current[0]?.focus();
  }

  function completo(codigo: string) {
    if (confirmar && primeiro === null) {
      setPrimeiro(codigo);
      limpar();
      return;
    }
    if (confirmar && primeiro !== codigo) {
      setPrimeiro(null);
      setError('Os dois não bateram. Digite de novo.');
      limpar();
      return;
    }
    startTransition(async () => {
      const res = await enviar(codigo);
      if (res?.error) {
        setError(res.error);
        setPrimeiro(null);
        limpar();
      }
    });
  }

  function setDigit(i: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    const novo = [...digits];
    novo[i] = v;
    setDigits(novo);
    setError(null);
    if (v && i < 3) inputs.current[i + 1]?.focus();
    if (novo.every((d) => d)) completo(novo.join(''));
  }

  return (
    <div className="w-full max-w-xs space-y-4">
      {confirmar && (
        <p className="text-center text-xs text-white/60">{primeiro === null ? 'Escolha 4 números' : 'Repita para confirmar'}</p>
      )}
      <div className="flex justify-center gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            type="password"
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            disabled={pending}
            autoFocus={i === 0}
            aria-label={`Número ${i + 1} de 4`}
            className="h-16 w-14 rounded-2xl border border-white/15 bg-white/5 text-center text-2xl font-bold text-[#F5F6F4] outline-none focus:border-[#DFFFAE] focus:ring-2 focus:ring-[#DFFFAE]/30 disabled:opacity-50"
          />
        ))}
      </div>
      {error && <p className="text-center text-sm text-red-300">{error}</p>}
      {pending && <p className="text-center text-xs text-white/50">Conferindo…</p>}
    </div>
  );
}
