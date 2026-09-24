'use client';

import { ArrowUpRight } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function SalesforceDuoCards({
  lucroBruto,
  lucroLiquido,
  margemBruta,
  margemLiquida,
}: {
  lucroBruto: number;
  lucroLiquido: number;
  margemBruta?: number;
  margemLiquida?: number;
}) {
  return (
    <div className="flex flex-col gap-5 h-full">
      {/* ── Card 1: Lucro Bruto em Verde Limão Vibrante (#D4FF00) ─────────────── */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#D4FF00] p-6 sm:p-7 text-neutral-900 shadow-[0_12px_32px_rgba(212,255,0,0.25)] flex flex-col justify-between flex-1 min-h-[190px] group transition-transform hover:scale-[1.01]">
        {/* Linhas circulares concêntricas decorativas (estilo Salesforce) */}
        <svg
          className="absolute -right-8 -top-8 h-48 w-48 pointer-events-none opacity-25 text-neutral-950"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="25" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="105" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="125" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div>
            <p className="rotulo text-neutral-900/80">
              Lucro Bruto Operacional
            </p>
            <p className="text-[11px] font-medium text-neutral-900/60 mt-0.5">
              Receitas menos despesas diretas
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[#D4FF00] shadow-sm group-hover:scale-110 transition-transform">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        <div className="relative z-10 mt-4">
          <div className="font-serif text-3xl sm:text-4xl font-black tabular tracking-tight text-neutral-950">
            {BRL.format(lucroBruto)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-bold text-neutral-900">
              {margemBruta ? pct(margemBruta) : 'Margem Bruta'}
            </span>
            <span className="text-[11px] font-semibold text-neutral-900/70">
              eficiência de vendas
            </span>
          </div>
        </div>
      </div>

      {/* ── Card 2: Lucro Líquido em Preto Matte / Obsidian (#0A0D0B) ────────── */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#0A0D0B] p-6 sm:p-7 text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] border border-white/10 flex flex-col justify-between flex-1 min-h-[190px] group transition-transform hover:scale-[1.01]">
        {/* Linhas circulares concêntricas decorativas (estilo Salesforce) */}
        <svg
          className="absolute -right-8 -bottom-8 h-48 w-48 pointer-events-none opacity-20 text-[#D4FF00]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="25" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="105" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="125" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div>
            <p className="rotulo text-white/70">
              Lucro Líquido Isento
            </p>
            <p className="text-[11px] font-medium text-white/50 mt-0.5">
              Disponível aos sócios no bolso
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[#D4FF00] shadow-sm backdrop-blur-sm group-hover:bg-[#D4FF00] group-hover:text-black transition-all">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        <div className="relative z-10 mt-4">
          <div className="font-serif text-3xl sm:text-4xl font-black tabular tracking-tight text-[#D4FF00] drop-shadow-sm">
            {BRL.format(lucroLiquido)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-[#D4FF00]">
              {margemLiquida ? pct(margemLiquida) : 'Isento IRPF'}
            </span>
            <span className="text-[11px] font-medium text-white/60">
              após deduções e tributos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
