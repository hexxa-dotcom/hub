'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { decidirPropostaAction } from './actions';

const campo = 'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#0C110E] outline-none focus:border-[#0C110E]';

export function Resposta({ token, emailSugerido }: { token: string; emailSugerido: string | null }) {
  const router = useRouter();
  const [modo, setModo] = useState<'aceitar' | 'recusar' | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState(emailSugerido ?? '');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await decidirPropostaAction(token, modo === 'aceitar', nome, email, nota);
      if (!r.ok) return setErro(r.message);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (!modo) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => setModo('aceitar')} className="flex-1 rounded-full bg-[#0C110E] px-6 py-3.5 text-sm font-bold text-[#D4FF00]">
          Aceitar proposta
        </button>
        <button type="button" onClick={() => setModo('recusar')} className="rounded-full px-6 py-3.5 text-sm font-semibold text-black/60 ring-1 ring-black/15 hover:text-black">
          Recusar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06]">
      <p className="text-sm font-semibold">{modo === 'aceitar' ? 'Confirme quem está aceitando' : 'Quer dizer o motivo? (opcional)'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-black/50">
          Seu nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>
        <label className="block text-xs text-black/50">
          Seu e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </label>
      </div>
      <label className="block text-xs text-black/50">
        {modo === 'aceitar' ? 'Observação (opcional)' : 'Motivo'}
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={`${campo} resize-none`} />
      </label>
      {erro && <p className="text-xs font-semibold text-rose-600">{erro}</p>}
      <div className="flex items-center gap-4">
        <button type="button" onClick={enviar} disabled={enviando} className="inline-flex items-center gap-2 rounded-full bg-[#0C110E] px-6 py-3 text-sm font-bold text-[#D4FF00] disabled:opacity-60">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {modo === 'aceitar' ? 'Confirmar aceite' : 'Enviar resposta'}
        </button>
        <button type="button" onClick={() => setModo(null)} className="text-xs font-semibold text-black/50 hover:text-black">
          Voltar
        </button>
      </div>
      {modo === 'aceitar' && <p className="text-[11px] text-black/45">Ficam registrados seu nome, e-mail, data, hora e IP.</p>}
    </div>
  );
}
