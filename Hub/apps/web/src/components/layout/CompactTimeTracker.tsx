'use client';

import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { useTimeTracker } from '@/lib/client/useTimeTracker';

export function CompactTimeTracker({ userEmail }: { userEmail?: string }) {
  const { formattedTime, isRunning, isEnabled, toggleRunning, reset } = useTimeTracker(userEmail);

  if (!isEnabled) return null;

  return (
    <div
      data-card="time-tracker-compact"
      className="relative overflow-hidden rounded-2xl bg-[#111c15] dark:bg-[#0c140f] p-3.5 text-white shadow-md border border-emerald-500/20 my-2 select-none group"
    >
      {/* Padrão de linhas orgânicas concêntricas com textura sutil */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none opacity-20 text-[#DFFFAE]"
        viewBox="0 0 280 140"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M-40 110 C 40 70, 130 160, 310 90" stroke="currentColor" strokeWidth="1" />
        <path d="M-40 90 C 60 50, 150 140, 310 70" stroke="currentColor" strokeWidth="1" />
        <path d="M-40 70 C 80 30, 170 120, 310 50" stroke="currentColor" strokeWidth="1" />
        <path d="M-40 50 C 100 10, 190 100, 310 30" stroke="currentColor" strokeWidth="1" />
        <circle cx="230" cy="110" r="50" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="230" cy="110" r="30" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Header compacto */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-[#DFFFAE]">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-tight text-white/95 leading-none">Time Tracker</p>
            <p className="text-[9px] text-white/60 leading-tight mt-0.5">Tempo no negócio</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#DFFFAE]">
          <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-[#DFFFAE] animate-pulse' : 'bg-white/40'}`} />
          <span>{isRunning ? 'Ativo' : 'Pausado'}</span>
        </div>
      </div>

      {/* Timer digital & Controles */}
      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-3 bg-white/[0.04] rounded-xl p-2 border border-white/5">
        <div>
          <div className="font-mono text-xl font-extrabold tracking-wider text-white tabular leading-none">
            {formattedTime}
          </div>
          <p className="text-[9px] text-white/60 mt-1 font-medium leading-none">
            Dedicado à gestão hoje
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRunning();
            }}
            title={isRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
            className="tap-target pressable flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111c15] shadow-sm hover:bg-[#DFFFAE] active:scale-95 transition-all"
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
            title="Zerar cronômetro de hoje"
            className="tap-target pressable flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs hover:bg-rose-500/30 active:scale-95 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
