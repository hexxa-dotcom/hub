'use client';

import { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

interface SectionInfoProps {
  title?: string;
  description: React.ReactNode;
  className?: string;
  /** Sem efeito: o cartão agora abre sempre abaixo, à direita. */
  variant?: 'inline' | 'floating';
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
      className={`relative flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* O (i) fica discreto no canto direito do topo da seção: sem fundo,
          sem borda, só o traço do ícone. Antes era um círculo branco colado
          ao título, e competia com ele. */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Informações sobre esta seção"
        aria-expanded={isOpen}
        className={`tap-target pressable focusable shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
          isOpen ? 'text-ink' : 'text-ink-soft/60 hover:text-ink'
        }`}
      >
        <Info className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* A explicação abre num cartão logo abaixo, alinhado à direita. */}
      <div
        role="region"
        aria-label={title}
        className={`absolute right-0 top-full z-40 mt-2 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-black/8 bg-surface p-4 shadow-(--elev-3) transition-all duration-200 ease-out dark:border-white/10 ${
          isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
        }`}
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
