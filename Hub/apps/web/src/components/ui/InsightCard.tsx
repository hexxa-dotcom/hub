'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

/** Card de dica contextual por IA — discreto, dispensável, some sozinho se a dica for a mesma de antes. */
export function InsightCard({ pageKey, insight }: { pageKey: string; insight: string | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!insight) return;
    const key = `hexxa.insight.dismissed.${pageKey}`;
    setDismissed(localStorage.getItem(key) === insight);
  }, [pageKey, insight]);

  if (!insight || dismissed) return null;

  function handleDismiss() {
    if (!insight) return;
    localStorage.setItem(`hexxa.insight.dismissed.${pageKey}`, insight);
    setDismissed(true);
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#DFFFAE]/60 bg-[#EFFFD6]/60 dark:bg-[#1E3328]/40 dark:border-[#2F4A3C] p-4 animate-in fade-in">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1E3328] text-[#DFFFAE]">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <p className="flex-1 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] pt-0.5">{insight}</p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dispensar dica"
        className="shrink-0 rounded-full p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 dark:text-[#A8A49C]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
