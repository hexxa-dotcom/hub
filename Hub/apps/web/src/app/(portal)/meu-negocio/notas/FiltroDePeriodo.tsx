'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';

/**
 * FILTRO DE PERÍODO — além do mês, "os últimos 15 dias" ou um de/até.
 *
 * Sem período escolhido, a lista segue o mês do seletor lá em cima. Com
 * período, ele manda (e atravessa o mês); o × volta para o mês.
 */

export interface Periodo {
  de: string; // AAAA-MM-DD
  ate: string;
}

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const menosDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
export const textoDoPeriodo = (p: Periodo) => (p.de === p.ate ? `em ${br(p.de)}` : `de ${br(p.de)} a ${br(p.ate)}`);

const ATALHOS = [
  { dias: 7, rotulo: 'Últimos 7 dias' },
  { dias: 15, rotulo: 'Últimos 15 dias' },
  { dias: 30, rotulo: 'Últimos 30 dias' },
];

export function FiltroDePeriodo({ periodo, aoEscolher }: { periodo: Periodo | null; aoEscolher: (p: Periodo | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(periodo?.de ?? menosDias(hojeSP(), 14));
  const [ate, setAte] = useState(periodo?.ate ?? hojeSP());
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const escolher = (p: Periodo | null) => {
    setAberto(false);
    aoEscolher(p);
  };

  return (
    <div ref={caixa} className="relative">
      <div
        className={`inline-flex items-center rounded-full border text-xs font-semibold transition-colors ${
          periodo ? 'border-hexxa-forest/40 text-ink dark:border-hexxa-lime/40' : 'border-black/15 text-ink dark:border-white/20'
        }`}
      >
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
          {periodo ? `Período ${textoDoPeriodo(periodo)}` : 'Período'}
          <ChevronDown className={`h-3.5 w-3.5 text-ink-soft transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
        </button>
        {periodo && (
          <button type="button" onClick={() => escolher(null)} aria-label="Voltar para o mês" className="mr-1.5 rounded-full p-1 text-ink-soft hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-3xl border border-white/60 bg-white/85 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-[#151916]/95 dark:ring-white/5">
          <button
            type="button"
            onClick={() => escolher(null)}
            className="block w-full rounded-2xl px-3 py-2 text-left text-sm text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            O mês inteiro
          </button>
          {ATALHOS.map((a) => (
            <button
              key={a.dias}
              type="button"
              onClick={() => escolher({ de: menosDias(hojeSP(), a.dias - 1), ate: hojeSP() })}
              className="block w-full rounded-2xl px-3 py-2 text-left text-sm text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              {a.rotulo}
            </button>
          ))}
          <div className="mt-1 space-y-2 border-t border-black/[0.08] px-3 pb-2 pt-3 dark:border-white/[0.12]">
            <p className="rotulo text-ink-soft">Escolher as datas</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-ink-soft">
                De
                <input
                  type="date"
                  value={de}
                  max={ate}
                  onChange={(e) => setDe(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-2 py-1.5 text-xs text-ink dark:border-white/15 dark:bg-white/5"
                />
              </label>
              <label className="space-y-1 text-[11px] text-ink-soft">
                Até
                <input
                  type="date"
                  value={ate}
                  min={de}
                  onChange={(e) => setAte(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white/60 px-2 py-1.5 text-xs text-ink dark:border-white/15 dark:bg-white/5"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!de || !ate || de > ate}
              onClick={() => escolher({ de, ate })}
              className="w-full rounded-full border border-black/15 py-1.5 text-xs font-semibold text-ink hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/[0.06]"
            >
              Ver este período
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
