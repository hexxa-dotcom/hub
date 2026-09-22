'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Target } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { getStoredTheme, resolveTheme, setTheme, type Theme, type ResolvedTheme } from '@/lib/theme';

const THEME_OPTIONS: { id: ResolvedTheme; label: string; icon: typeof Moon }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
  { id: 'focus', label: 'Foco', icon: Target },
];

/**
 * Seletor de 3 estados para o Cabeçalho (Header).
 * Permite alternar diretamente entre:
 * - Claro: Visual limpo com cores completas e cards brancos
 * - Escuro: Dark mode cinematográfico com acentos neon
 * - Foco: Base cinza cimento 100% monocromática (preto e branco) para descanso visual
 */
export function ThemeHeaderSelector({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<ResolvedTheme>('light');
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme();
    setCurrent(resolveTheme(stored));

    const handleStorage = () => {
      setCurrent(resolveTheme(getStoredTheme()));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Fechar ao clicar fora (mobile / acessibilidade)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsHovered(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Pequeno debounce de 80ms para resposta imediata e fluida, sem atrasos perceptíveis
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsOpen(false);
    }, 80);
  };

  function handleSelect(mode: ResolvedTheme) {
    setCurrent(mode);
    setTheme(mode);
    setIsHovered(false);
    setIsOpen(false);
  }

  const isExpanded = isHovered || isOpen;

  // Dimensões numéricas exatas para interpolação fluida sem FLIP layout e sem travamentos
  const buttonWidth = compact ? 28 : 74;
  const collapsedWidth = compact ? 32 : 78;
  const expandedWidth = compact ? 92 : 230;

  // Transição física suave e contínua no padrão Apple (critically damped spring) idêntica à barra de busca
  const springTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: 'spring', stiffness: 240, damping: 26, mass: 0.8 };

  if (!mounted) {
    return (
      <div
        className={`inline-flex h-8 items-center rounded-full border border-line bg-surface/80 p-0.5 shadow-(--elev-inset) ${
          compact ? 'w-8' : 'w-[78px]'
        }`}
      />
    );
  }

  return (
    <motion.div
      ref={containerRef}
      role="group"
      aria-label="Seleção de Tema Visual"
      initial={false}
      animate={{
        width: isExpanded ? expandedWidth : collapsedWidth,
      }}
      transition={springTransition}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setIsOpen(true)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
          setIsHovered(false);
        }
      }}
      className="relative inline-flex h-8 items-center rounded-full border border-black/8 dark:border-white/10 bg-surface/80 p-0.5 shadow-(--elev-inset) overflow-hidden"
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = current === opt.id;
        const isVisible = isExpanded || isActive;

        return (
          <motion.button
            key={opt.id}
            type="button"
            initial={false}
            animate={{
              width: isVisible ? buttonWidth : 0,
              opacity: isVisible ? 1 : 0,
              marginRight: isExpanded && opt.id !== 'focus' ? 2 : 0,
            }}
            transition={springTransition}
            onClick={() => {
              if (!isExpanded) {
                setIsOpen(true);
              } else {
                handleSelect(opt.id);
              }
            }}
            tabIndex={isVisible ? 0 : -1}
            aria-hidden={!isVisible}
            title={isActive ? `Tema atual: ${opt.label}` : `Mudar para ${opt.label}`}
            aria-label={`Tema ${opt.label}${isActive ? ' (ativo)' : ''}`}
            aria-pressed={isActive}
            className={`tap-target pressable focusable inline-flex h-7 items-center justify-center rounded-full text-xs cursor-pointer shrink-0 overflow-hidden ${
              isActive
                ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-xs font-semibold'
                : 'text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 font-medium'
            }`}
          >
            <div
              style={{ width: buttonWidth }}
              className={`h-full flex items-center justify-center gap-1.5 select-none whitespace-nowrap ${
                compact ? 'w-7' : 'px-2'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {!compact && <span>{opt.label}</span>}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

/**
 * Botão clássico ThemeToggle compatível com usos existentes.
 * Se collapsed=true ou compact=true, exibe a pílula de 3 ícones compacta.
 * Se collapsed=false, exibe o seletor completo com rótulos.
 */
export function ThemeToggle({ collapsed = false, compact }: { collapsed?: boolean; compact?: boolean }) {
  const isCompact = compact ?? collapsed;
  return <ThemeHeaderSelector compact={isCompact} />;
}

/** Seletor segmentado para páginas de Configurações / Preferências. */
export function ThemeSegmented() {
  const [mounted, setMounted] = useState(false);
  const [theme, setLocal] = useState<Theme>('system');

  useEffect(() => {
    setMounted(true);
    setLocal(getStoredTheme());
  }, []);

  const ALL_OPTIONS: { id: Theme; label: string; icon: typeof Moon }[] = [
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'dark', label: 'Escuro', icon: Moon },
    { id: 'focus', label: 'Foco (P&B)', icon: Target },
  ];

  function handleSelect(t: Theme) {
    setLocal(t);
    setTheme(t);
  }

  if (!mounted) return null;

  return (
    <div className="flex rounded-full border border-line bg-surface p-1 text-xs shadow-(--elev-inset)">
      {ALL_OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => handleSelect(o.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all cursor-pointer ${
              active
                ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm font-semibold'
                : 'text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
