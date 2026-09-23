'use client';

import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { useTimeTracker } from '@/lib/client/useTimeTracker';

export function TimeTrackerCard() {
  const { formattedTime, isRunning, isEnabled, toggleRunning, reset } = useTimeTracker();

  if (!isEnabled) return null;

  return (
    <div data-card="true" className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-[#111c15]/85 dark:bg-[#111c15]/75 p-5 sm:p-6 text-white shadow-lg border border-emerald-500/20 flex flex-col justify-between min-h-[220px] group">
      {/* Padrão de linhas orgânicas concêntricas ao fundo (estilo Donezo) */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none opacity-20 text-[#DFFFAE] atmospheric-glow"
        viewBox="0 0 300 220"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M-50 180 C 50 120, 150 250, 350 140" stroke="currentColor" strokeWidth="1" />
        <path d="M-50 150 C 70 90, 170 220, 350 110" stroke="currentColor" strokeWidth="1" />
        <path d="M-50 120 C 90 60, 190 190, 350 80" stroke="currentColor" strokeWidth="1" />
        <path d="M-50 90 C 110 30, 210 160, 350 50" stroke="currentColor" strokeWidth="1" />
        <path d="M-50 60 C 130 0, 230 130, 350 20" stroke="currentColor" strokeWidth="1" />
        <circle cx="270" cy="180" r="80" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="270" cy="180" r="50" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Header com indicador pulsante */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-[#DFFFAE]">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-tight text-white/90">Time Tracker</p>
            <p className="text-[10px] text-white/60">Tempo no negócio</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#DFFFAE]">
          <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-[#DFFFAE] animate-pulse' : 'bg-white/40'}`} />
          <span>{isRunning ? 'Ativo' : 'Pausado'}</span>
        </div>
      </div>

      {/* Display do Timer digital grande */}
      <div className="relative z-10 my-4 text-center">
        <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-wider text-white drop-shadow-sm tabular">
          {formattedTime}
        </div>
        <p className="text-[11px] text-white/65 mt-1 font-medium">
          Dedicado à gestão estratégica hoje
        </p>
      </div>

      {/* Botões de Ação estilo Donezo (Pausar/Play em pílula branca e Stop vermelho/escuro) */}
      <div className="relative z-10 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleRunning}
          title={isRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
          className="tap-target pressable flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#111c15] shadow-md hover:bg-[#DFFFAE] hover:scale-105 active:scale-95 transition-all"
        >
          {isRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={reset}
          title="Zerar cronômetro de hoje"
          className="tap-target pressable flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm hover:bg-rose-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
