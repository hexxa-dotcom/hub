'use client';

import { Play, Pause, RotateCcw, X } from 'lucide-react';
import { useTimeTracker } from '@/lib/client/useTimeTracker';

/**
 * O cronômetro no menu do usuário: uma linha só — rótulo, tempo, controles.
 * Fechar esconde daqui; o menu oferece "Mostrar cronômetro" para trazer de
 * volta (ver `MostrarCronometro`).
 */
export function CompactTimeTracker({ userEmail }: { userEmail?: string }) {
  const { formattedTime, isRunning, isEnabled, toggleRunning, reset, setIsEnabled } = useTimeTracker(userEmail);

  if (!isEnabled) return null;

  const botao =
    'tap-target pressable grid h-7 w-7 place-items-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10';

  return (
    <div data-card="time-tracker-compact" className="flex select-none items-center gap-3 px-1 py-2.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isRunning ? 'animate-pulse bg-emerald-500' : 'bg-black/20 dark:bg-white/25'}`} />
      <div className="min-w-0 flex-1">
        <p className="rotulo text-ink-soft">Tempo na gestão</p>
        <p className="font-mono text-sm font-bold tabular text-ink">{formattedTime}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleRunning();
        }}
        title={isRunning ? 'Pausar' : 'Iniciar'}
        className="tap-target pressable grid h-7 w-7 place-items-center rounded-full bg-ink text-surface transition-opacity hover:opacity-85"
      >
        {isRunning ? <Pause className="h-3 w-3 fill-current" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          reset();
        }}
        title="Zerar o tempo de hoje"
        className={botao}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsEnabled(false);
        }}
        title="Fechar o cronômetro"
        className={botao}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Traz o cronômetro de volta depois de fechado. Some enquanto ele aparece. */
export function MostrarCronometro({ userEmail, className = '' }: { userEmail?: string; className?: string }) {
  const { isEnabled, setIsEnabled } = useTimeTracker(userEmail);
  if (isEnabled) return null;
  return (
    <button type="button" onClick={() => setIsEnabled(true)} className={className}>
      Mostrar cronômetro
    </button>
  );
}
