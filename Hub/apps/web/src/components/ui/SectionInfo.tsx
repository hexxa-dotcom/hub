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
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return; // Se foi fixado por clique, mantém aberto!
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const toggleOpen = () => {
    if (isOpen && isPinned) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  const close = () => {
    setIsPinned(false);
    setIsOpen(false);
  };

  // Fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
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
      className={`relative flex items-center min-w-0 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão (i) no canto esquerdo da barra */}
      <button
        type="button"
        onClick={toggleOpen}
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

      {/* Informação que abre na horizontal, diretamente sobre o card no espaço livre (sem moldura e sem alterar altura do card) */}
      <div
        role="region"
        aria-label={title}
        className={`absolute left-11 top-1/2 -translate-y-1/2 z-20 transition-all duration-250 ease-out ${
          isOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-3 pointer-events-none'
        }`}
        style={{
          width: 'max-content',
          maxWidth: 'min(580px, calc(100vw - 460px))',
        }}
      >
        <div className="flex items-start gap-3 py-0.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            {title && (
              <span className="font-bold text-xs sm:text-sm text-ink tracking-tight">
                {title}
              </span>
            )}
            <p className="text-xs text-ink-soft leading-relaxed">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="shrink-0 rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer mt-0.5"
            aria-label="Fechar informações"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
