'use client';

import { useState } from 'react';
import { Eye, EyeSlash, ArrowLeft } from '@phosphor-icons/react';

export const campoCadastro =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-black placeholder:text-black/35 focus:border-black focus:outline-none';

/** Senha com "mostrar": a do certificado é longa, e digitar às cegas erra. */
export function CampoSenha({ name, id }: { name: string; id: string }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visivel ? 'text' : 'password'}
        autoComplete="off"
        required
        className={`${campoCadastro} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-black/50 hover:text-black"
      >
        {visivel ? <EyeSlash className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** (00) 00000-0000 enquanto digita; fixo ou celular, no máximo 11 dígitos. */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function CampoTelefone({ name, id }: { name: string; id: string }) {
  const [valor, setValor] = useState('');
  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="(00) 00000-0000"
      maxLength={15}
      required
      value={valor}
      onChange={(e) => setValor(mascaraTelefone(e.target.value))}
      className={campoCadastro}
    />
  );
}

/** O "voltar" mora no canto superior esquerdo da tela, fora da caixa. */
export function VoltarNoCanto({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-black/70 hover:bg-black/5 hover:text-black"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar
    </button>
  );
}
