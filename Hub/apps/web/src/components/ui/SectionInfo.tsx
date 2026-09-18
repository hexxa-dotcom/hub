'use client';

import { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

interface SectionInfoProps {
  title?: string;
  description: React.ReactNode;
  className?: string;
}

export function SectionInfo({ title = 'Sobre esta seção', description, className = '' }: SectionInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  // Fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-3 min-w-0 flex-1 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão (i) no canto esquerdo da barra */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Informações sobre esta seção"
        aria-expanded={isOpen}
        className={`tap-target pressable focusable group shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all cursor-pointer ${
          isOpen
            ? 'border-hexxa-green/40 bg-surface-card text-hexxa-green dark:text-hexxa-lime shadow-(--elev-inset) scale-105'
            : 'border-black/5 dark:border-white/10 bg-surface-card text-ink-soft hover:text-ink shadow-(--elev-inset) hover:shadow-(--elev-1) hover:scale-105'
        }`}
      >
        <Info className="h-4 w-4 transition-transform group-hover:scale-110" />
      </button>

      {/* Informação que abre na horizontal, diretamente sobre o card no espaço livre (sem moldura adicional) */}
      <div
        role="region"
        aria-label={title}
        className={`transition-all duration-300 ease-out sm:relative max-sm:absolute max-sm:left-12 max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:right-4 max-sm:z-40 ${
          isOpen
            ? 'opacity-100 max-w-2xl sm:translate-x-0'
            : 'opacity-0 max-w-0 pointer-events-none sm:-translate-x-2 max-sm:hidden'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 py-1">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-xs sm:text-sm min-w-0">
            {title && (
              <span className="font-semibold text-ink shrink-0">
                {title}:
              </span>
            )}
            <span className="text-ink-soft leading-snug">
              {description}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="shrink-0 rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer ml-1"
            aria-label="Fechar informações"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
