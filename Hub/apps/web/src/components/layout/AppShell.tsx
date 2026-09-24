'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, Menu, PanelLeft, X, Bell, BellOff, MessageCircle, Search, Pin, LogOut, ArrowUpRight } from 'lucide-react';
import {
  SquaresFour,
  Notebook,
  ArrowsDownUp,
  Handshake,
  IdentificationBadge,
  Buildings,
  ChatCircleDots,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import type { NavSection } from '@/lib/nav';
import { ThemeHeaderSelector } from '@/components/theme/ThemeControls';
import { getStoredTheme, resolveTheme } from '@/lib/theme';
import { useSignOut } from '@/lib/client/useSignOut';
import { CommandMenu } from './CommandMenu';
import { QuickActionsMenu } from './QuickActionsMenu';
import { UserMenu, type CurrentUserProfile } from './UserMenu';

const GROUP_ICONS: Record<string, PhosphorIcon> = {
  'Início': SquaresFour,
  'Contabilidade': Notebook,
  'Financeiro': ArrowsDownUp,
  'Relacionamento': Handshake,
  'Gestão de Pessoas': IdentificationBadge,
  'Patrimônio': Buildings,
  'Gestão do Patrimônio': Buildings,
  'Suporte': ChatCircleDots,
};

const STORAGE_KEY = 'hexxa.sidebar.collapsed';
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com minha contabilidade.')}`;

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`grid ${s} shrink-0 place-items-center rounded-full bg-[#1E3328] font-bold text-[#DFFFAE] border border-[#2F4A3C] shadow-sm`}>
      H
    </span>
  );
}

/**
 * Abacate entra só no item ativo, nunca como fundo do menu.
 *
 * Medindo as alternativas: abacate sobre branco dá 1,1:1 (ícone precisa de 3:1,
 * então é ilegível), e um painel abacate sobre a superfície cinza dá 1,3:1 —
 * recriaria o painel colorido flutuando que o relevo veio resolver. Como
 * acento, ele vira a única cor saturada da tela e o item ativo salta sem
 * precisar de peso, tamanho ou borda.
 */
function itemClass(active: boolean, isDarkOverlay: boolean = false) {
  const base =
    'flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 text-xs transition-all duration-200';
  if (active) {
    // Um destaque só: o traço ao lado e o texto mais forte — sem fundo cinza.
    return `${base} font-semibold text-(--sidebar-ink)`;
  }
  if (isDarkOverlay) {
    return `${base} font-medium text-[#F5F6F4]/75 hover:bg-white/10 hover:text-[#F5F6F4]`;
  }
  return `${base} font-medium text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) hover:bg-black/5 dark:hover:bg-white/5`;
}

function NavList({
  items,
  pathname,
  onNavigate,
  isDark = false,
  collapsed = false,
}: {
  items: { label: string; href: string; badge?: string }[];
  pathname: string;
  onNavigate?: () => void;
  isDark?: boolean;
  collapsed?: boolean;
}) {
  // prefetch=false: com ~20 links sempre visíveis na sidebar, o prefetch
  // automático do Next dispara todas as rotas dinâmicas (consultas ao banco)
  // de uma vez ao abrir qualquer página, o que já saturou o pool de conexões.
  return (
    <ul className="space-y-1">
      {items.map((i) => {
        const active = pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`));

        return (
          <li key={i.href} className="group relative list-none pl-[34px]">
            {/* Indicador lateral no item ativo */}
            {active && (
              <span className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-hexxa-forest dark:bg-hexxa-lime" />
            )}
            <Link
              href={i.href as never}
              onClick={onNavigate}
              className={itemClass(active, isDark)}
              prefetch={false}
              title={collapsed ? i.label : undefined}
            >
              {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{i.label}</span>}
              {!collapsed && i.badge && (
                <span className={`shrink-0 whitespace-nowrap text-[10px] font-medium lowercase ${isDark ? 'text-[#F5F6F4]/60' : 'text-(--sidebar-ink-soft)'}`}>
                  {i.badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra de Busca em tamanho reduzido com expansão suave e fluida no hover */
function HeaderSearchBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Pequeno debounce de 80ms apenas para evitar flicker em bordas, mantendo resposta imediata e fluida
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsFocused(false);
    }, 80);
  };

  const isExpanded = isHovered || isFocused;

  // Transição física suave e contínua no padrão Apple (critically damped spring)
  const springTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: 'spring', stiffness: 240, damping: 26, mass: 0.8 };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex items-center justify-end"
    >
      <motion.button
        type="button"
        onClick={onOpenCommand}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setIsFocused(false);
            setIsHovered(false);
          }
        }}
        initial={false}
        animate={{
          width: isExpanded ? 340 : 32,
        }}
        transition={springTransition}
        title="Buscar por comandos, clientes ou páginas (⌘K)"
        aria-label="Buscar por comandos, clientes ou páginas (⌘K)"
        className="group tap-target pressable focusable relative flex h-8 items-center justify-start rounded-full bg-surface/80 border border-black/8 dark:border-white/10 px-[8.5px] shadow-(--elev-1) hover:border-black/15 dark:hover:border-white/20 transition-colors cursor-pointer overflow-hidden"
      >
        {/* Fechada, é só a lupa — como os outros controles do topo. Aberta
            (passando o mouse), o texto desliza para a direita dela. */}
        <Search className="h-3.5 w-3.5 shrink-0 stroke-[2.4] text-ink-soft transition-colors group-hover:text-ink" />
        <motion.span
          initial={false}
          animate={{
            opacity: isExpanded ? 1 : 0,
            maxWidth: isExpanded ? 300 : 0,
          }}
          transition={
            reduceMotion
              ? { duration: 0.1 }
              : { duration: isExpanded ? 0.28 : 0.18, ease: [0.16, 1, 0.3, 1] }
          }
          className="pointer-events-none inline-block overflow-hidden truncate whitespace-nowrap pl-2 text-xs font-medium text-ink-soft select-none"
        >
          Buscar comandos, clientes, páginas… <span className="opacity-60">⌘K</span>
        </motion.span>
      </motion.button>
    </div>
  );
}

/** useSearchParams exige Suspense no prerender (Next 16). */
export function AppShell(props: {
  children: React.ReactNode;
  sections: NavSection[];
  company?: any;
  user?: CurrentUserProfile | null;
  userName?: string | null;
  userEmail?: string | null;
  hasMultipleCompanies?: boolean;
}) {
  return (
    <Suspense>
      <AppShellInner {...props} />
    </Suspense>
  );
}

function AppShellInner({
  children,
  sections,
  company,
  user,
  userName,
  userEmail,
  hasMultipleCompanies,
}: {
  children: React.ReactNode;
  sections: NavSection[];
  company?: any;
  user?: CurrentUserProfile | null;
  userName?: string | null;
  userEmail?: string | null;
  hasMultipleCompanies?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [avisoAdmin, setAvisoAdmin] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(() => {
    const currentSection = sections.find(s =>
      s.items.some(i => pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`)))
    );
    return currentSection ? currentSection.title : 'Início';
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: prev[title] === undefined ? !(title === activeGroup) : !prev[title]
    }));
  };

  useEffect(() => {
    if (searchParams.get('aviso') === 'sem-acesso-contador') setAvisoAdmin(true);
  }, [searchParams]);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusPinned, setFocusPinned] = useState(false);

  useEffect(() => {
    const updateThemeState = () => {
      const isFocus =
        (typeof document !== 'undefined' && document.documentElement.classList.contains('theme-focus')) ||
        resolveTheme(getStoredTheme()) === 'focus';
      setIsFocusMode(isFocus);
      if (isFocus) {
        setFocusPinned(false);
      } else {
        setIsPinned(localStorage.getItem(STORAGE_KEY) !== '1');
      }
    };
    updateThemeState();

    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('storage', updateThemeState);
    window.addEventListener('themechange', updateThemeState);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', updateThemeState);
      window.removeEventListener('themechange', updateThemeState);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const currentSection = sections.find(s => 
      s.items.some(i => pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`)))
    );
    if (currentSection) {
      setActiveGroup(currentSection.title);
    }
  }, [pathname, sections]);

  const activeSectionData = sections.find((s) => s.title === activeGroup) || sections[0];

  const sair = useSignOut('cliente');

  const breadcrumb = (() => {
    for (const s of sections) {
      const item = s.items.find(
        (i) => pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`)),
      );
      if (item) {
        const isInicio = item.label.toLowerCase() === 'início' || s.title.toLowerCase() === 'início' || pathname === '/cliente';
        if (isInicio) {
          return { section: null, page: null };
        }
        return {
          section: s.title === item.label ? null : s.title,
          page: item.label,
        };
      }
    }
    return { section: null, page: null };
  })();

  // No Modo Foco, a barra lateral recolhe automaticamente para maximizar a área útil (estilo Zen Shell), abrindo sob hover
  const isCollapsed = isFocusMode
    ? (!focusPinned && !isHovered)
    : (!isPinned && !isHovered);

  // Aplicativo emoldurado: a casca escura é o "fora", e o conteúdo é um painel
  // claro arredondado flutuando dentro dela. A trilha de ícones vive sobre a
  // casca, não sobre a página — era isso que faltava para ela descolar: antes
  // tinha exatamente a mesma cor do fundo.
  //
  // No celular a moldura some (`lg:`): margem sobrando é espaço que a tela
  // pequena não tem para dar.
  return (
    <div className="relative flex h-screen bg-transparent text-ink overflow-hidden">
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Fundo com iluminação atmosférica suave que banha o fundo da aplicação e a sidebar */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden atmospheric-glow">
        <div className="absolute -top-32 left-10 h-[560px] w-[560px] rounded-full bg-[#D4FF00]/12 dark:bg-[#D4FF00]/5 blur-[150px]" />
        <div className="absolute top-1/3 -left-20 h-[640px] w-[640px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/4 blur-[160px]" />
        <div className="absolute bottom-10 right-10 h-[520px] w-[520px] rounded-full bg-emerald-700/8 dark:bg-emerald-700/4 blur-[140px]" />
      </div>

      {/* Zona discreta na borda esquerda no Modo Foco para expandir com o mouse */}
      {isFocusMode && isCollapsed && (
        <div
          onMouseEnter={() => setIsHovered(true)}
          className="fixed left-0 top-0 bottom-0 w-3 z-50 cursor-pointer"
          title="Mover cursor para a borda esquerda para abrir navegação"
        />
      )}

      {/* Drawer mobile + backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-surface shadow-(--elev-3) transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between px-6 border-b border-black/5 dark:border-white/10 bg-[#1E3328] text-white">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-base font-serif font-bold text-[#DFFFAE]">Hexx Hub</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-4 space-y-6">
          {sections.map(s => {
            const hasSubmenu = s.title !== 'Início' && (s.items.length > 1 || (s.items.length === 1 && s.title !== s.items[0]?.label));
            const firstItem = s.items[0];
            const GroupIcon = GROUP_ICONS[s.title] ?? SquaresFour;

            if (!hasSubmenu && firstItem) {
              const active = pathname === firstItem.href;
              return (
                <div key={s.title}>
                  <Link
                    href={firstItem.href as never}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                      active
                        ? 'text-(--sidebar-ink) bg-black/5 dark:bg-white/10'
                        : 'text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <GroupIcon
                      weight="light"
                      className={`h-6 w-6 ${active ? 'text-hexxa-lime dark:text-hexxa-green' : ''}`}
                    />
                    <span className="text-[15px] font-bold text-ink">{s.title}</span>
                  </Link>
                </div>
              );
            }

            return (
              <div key={s.title}>
                <Link
                  href={(firstItem?.href ?? '#') as never}
                  onClick={() => setMobileOpen(false)}
                  className="mb-2 flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <GroupIcon
                    weight="light"
                    className={`h-6 w-6 ${activeGroup === s.title ? 'text-hexxa-lime dark:text-hexxa-green' : ''}`}
                  />
                  <span className="text-[15px] font-bold text-ink">{s.title}</span>
                </Link>
                <NavList items={s.items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </div>
            );
          })}
        </div>
      </aside>

      {/* BLOCO UNIFICADO DO SISTEMA: Inteiriço de ponta a ponta, sem cantos arredondados externos ou moldura encapsulada */}
      <div className="relative flex min-w-0 flex-1 overflow-hidden bg-surface/50 dark:bg-surface/30 backdrop-blur-2xl">
        {/* Fundo com iluminação atmosférica verde e vibrante unificada */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden atmospheric-glow">
          <div className="absolute -top-32 right-1/4 h-[580px] w-[580px] rounded-full bg-[#D4FF00]/18 dark:bg-[#D4FF00]/10 blur-[130px]" />
          <div className="absolute top-1/3 -left-20 h-[640px] w-[640px] rounded-full bg-emerald-500/16 dark:bg-emerald-500/8 blur-[150px]" />
          <div className="absolute bottom-10 right-10 h-[540px] w-[540px] rounded-full bg-emerald-700/14 dark:bg-emerald-700/8 blur-[140px]" />
        </div>

        {/* Desktop Sidebar integrada ao bloco com animação física fluida Apple via Framer Motion */}
        <motion.aside
          initial={false}
          animate={{
            width: isFocusMode
              ? (isCollapsed ? 0 : 264)
              : (isCollapsed ? 72 : 264),
            opacity: isFocusMode && isCollapsed ? 0 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 34,
            mass: 0.6,
          }}
          style={{ overflow: 'hidden' }}
          className={`z-40 hidden h-full shrink-0 flex-col bg-transparent text-(--sidebar-ink) lg:flex ${
            isFocusMode && isCollapsed ? 'pointer-events-none' : ''
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Container interno de largura fixa (264px) para eliminar reflow durante o spring */}
          <div className="flex h-full w-[264px] flex-col shrink-0 overflow-hidden">
            {/* Header / Brand & Company */}
            <div className="h-[72px] flex items-center px-3 shrink-0">
              <div className="flex w-full items-center justify-between rounded-2xl p-1.5">
                <Link
                  href="/minha-empresa"
                  title="Ver perfil da empresa"
                  className="flex items-center gap-3 overflow-hidden rounded-xl p-1 -m-1 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer group select-none flex-1 min-w-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hexxa-forest text-hexxa-lime font-extrabold text-sm shadow-sm border border-white/10 group-hover:scale-105 transition-transform duration-200">
                    {company
                      ? (company.useTradeName && company.tradeName ? company.tradeName[0] : company.legalName[0])
                      : 'H'}
                  </div>
                  <div
                    className={`flex min-w-0 flex-1 flex-col items-start overflow-hidden text-left transition-opacity duration-150 ${
                      isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <span className="w-full truncate text-sm font-bold leading-tight text-(--sidebar-ink) group-hover:text-hexxa-forest dark:group-hover:text-hexxa-lime transition-colors">
                      {company
                        ? (company.useTradeName && company.tradeName ? company.tradeName : company.legalName)
                        : 'Hexxa Hub'}
                    </span>
                    <span className="text-[10px] font-medium text-(--sidebar-ink-soft) group-hover:text-ink truncate flex items-center gap-1 transition-colors">
                      Painel da empresa
                      <ArrowUpRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </span>
                  </div>
                </Link>

                {/* PIN BUTTON */}
                <button
                  onClick={() => {
                    if (isFocusMode) {
                      setFocusPinned(prev => !prev);
                    } else {
                      const newVal = !isPinned;
                      setIsPinned(newVal);
                      localStorage.setItem(STORAGE_KEY, newVal ? '0' : '1');
                    }
                  }}
                  title={
                    (isFocusMode ? focusPinned : isPinned)
                      ? "Desafixar menu"
                      : "Fixar menu"
                  }
                  className={`grid h-7 w-7 shrink-0 place-items-center bg-transparent transition-all duration-150 ${
                    isCollapsed ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
                  } ${
                    (isFocusMode ? focusPinned : isPinned)
                      ? 'text-hexxa-forest dark:text-hexxa-lime' 
                      : 'text-ink-soft/60 hover:text-ink'
                  }`}
                >
                  <Pin className={`h-4 w-4 transition-transform duration-200 ${(isFocusMode ? focusPinned : isPinned) ? 'rotate-0' : 'rotate-45 opacity-50'}`} />
                </button>
              </div>
            </div>

            {/* Navigation Sections: pt-16 para posicionar os ícones harmoniosamente mais para baixo */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 pt-16 pb-20 w-full flex flex-col">
              <div className="space-y-2 w-full">
                {sections.map(s => {
                  const hasSubmenu = s.title !== 'Início' && (s.items.length > 1 || (s.items.length === 1 && s.title !== s.items[0]?.label));
                  const firstItem = s.items[0];
                  const isExpanded = expandedSections[s.title] ?? (s.title === activeGroup); // Default to active group
                  const GroupIcon = GROUP_ICONS[s.title] ?? SquaresFour;
                  const isActiveGroup = s.title === activeGroup;
                  
                  if (!hasSubmenu && firstItem) {
                    return (
                      <div key={s.title} className="flex flex-col">
                        <Link
                          href={firstItem.href as never}
                          onClick={() => {
                            setActiveGroup(s.title);
                          }}
                          title={isCollapsed ? s.title : undefined}
                          className={`relative tap-target pressable focusable mb-1 group flex items-center gap-3 overflow-hidden py-2.5 text-sm font-bold transition-all duration-200 ${
                            isCollapsed
                              ? '-ml-3 w-[64px] rounded-l-none rounded-r-xl pl-5 pr-2'
                              : 'w-full rounded-xl px-3'
                          } ${
                            isActiveGroup
                              ? 'text-(--sidebar-ink)'
                              : 'text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {/* Indicador lateral no grupo ativo */}
                          {isActiveGroup && (
                            <span className={`absolute top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-hexxa-forest dark:bg-hexxa-lime z-10 ${
                              isCollapsed ? 'left-1.5' : 'left-1'
                            }`} />
                          )}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                            <GroupIcon
                              weight="light"
                              className={`h-7 w-7 shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.22] group-hover:[transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
                                isActiveGroup ? 'text-hexxa-forest dark:text-hexxa-lime' : ''
                              }`}
                            />
                          </div>
                          <span
                            className={`flex-1 text-left truncate text-[15px] font-bold text-(--sidebar-ink) tracking-tight transition-opacity duration-150 ${
                              isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                            }`}
                          >
                            {s.title}
                          </span>
                        </Link>
                      </div>
                    );
                  }

                  return (
                    <div key={s.title} className="flex flex-col">
                      <div
                        className={`relative mb-1 group flex items-center overflow-hidden transition-all duration-200 ${
                          isCollapsed
                            ? '-ml-3 w-[64px] rounded-l-none rounded-r-xl'
                            : 'w-full rounded-xl'
                        } ${
                          isActiveGroup
                            ? 'text-(--sidebar-ink)'
                            : 'text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {/* Indicador do grupo só com a barra fechada; aberta, o traço
                            fica no item da página, para não haver dois. */}
                        {isActiveGroup && isCollapsed && (
                          <span className="absolute left-1.5 top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-full bg-hexxa-forest dark:bg-hexxa-lime" />
                        )}
                        <Link
                          href={(firstItem?.href ?? '#') as never}
                          onClick={() => {
                            setExpandedSections(prev => ({ ...prev, [s.title]: true }));
                            setActiveGroup(s.title);
                          }}
                          title={isCollapsed ? s.title : undefined}
                          className={`tap-target pressable focusable flex flex-1 items-center gap-3 overflow-hidden py-2.5 min-w-0 ${
                            isCollapsed ? 'pl-5 pr-2' : 'px-3'
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                            <GroupIcon
                              weight="light"
                              className={`h-7 w-7 shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.22] group-hover:[transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
                                isActiveGroup ? 'text-hexxa-forest dark:text-hexxa-lime' : ''
                              }`}
                            />
                          </div>
                          <span
                            className={`flex-1 text-left truncate text-[15px] font-bold text-(--sidebar-ink) tracking-tight transition-opacity duration-150 ${
                              isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                            }`}
                          >
                            {s.title}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSection(s.title);
                          }}
                          title={isExpanded ? 'Recolher' : 'Expandir'}
                          className={`tap-target pressable flex items-center justify-center text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) transition-all duration-150 ${
                            isCollapsed ? 'opacity-0 pointer-events-none w-0 p-0 overflow-hidden' : 'p-2 opacity-100'
                          }`}
                        >
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      
                      {/* Submenu Accordion */}
                      <div
                        className={`overflow-hidden transition-all duration-200 ease-out ${
                          isExpanded && !isCollapsed
                            ? 'max-h-[1000px] opacity-100 mb-2'
                            : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="w-full relative pl-4 pr-1 py-1 space-y-1">
                          {!isCollapsed && (
                            <div className="absolute left-[22px] top-0 bottom-2 w-px bg-current opacity-10" />
                          )}
                          <NavList items={s.items} pathname={pathname} collapsed={isCollapsed} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Painel de conteúdo: Header + Main */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar desktop com efeito translúcido */}
          <header className="z-30 hidden h-[72px] shrink-0 items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 bg-transparent px-8 lg:flex">
          {/* Esquerda: onde você está. A empresa não entra aqui porque a
              sidebar já a exibe no próprio cabeçalho — repetir seria gastar a
              posição de leitura primária com informação que já está na tela.
              "Onde estou" era justamente o que faltava. */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {/* Botão de acesso ao menu lateral no desktop: exclusivo do Modo Foco com ícone indicando barra lateral */}
            {isFocusMode && (
              <button
                type="button"
                onClick={() => {
                  setFocusPinned(prev => !prev);
                  setIsHovered(prev => !prev);
                }}
                title={(focusPinned || isHovered) ? "Recolher menu lateral" : "Abrir menu lateral"}
                className="tap-target pressable focusable grid h-8 w-8 shrink-0 place-items-center rounded-xl text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1 cursor-pointer"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
            {breadcrumb.section && (
              <>
                {/* Caixa alta pequena e espaçada, traço fino: sobrescrito, não compete com o título. */}
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-ink-soft">{breadcrumb.section}</span>
                <span className="text-[11px] font-light text-ink-soft opacity-40">/</span>
              </>
            )}
            {breadcrumb.page && (
              <h2 className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-ink">
                {breadcrumb.page}
              </h2>
            )}
          </div>

          {/* Espaçador flexível que permite à busca expandir para a esquerda */}
          <div className="flex-1 min-w-4" />

          {/* Direita: Buscar → Nova Ação → Seleção do tema → Notificação (da direita para a esquerda: Notificação é o primeiro) */}
          <div className="flex items-center gap-2 shrink-0">
            <QuickActionsMenu />
            <span className="mx-1 h-5 w-px bg-line" />
            <HeaderSearchBar onOpenCommand={() => setCommandOpen(true)} />
            <ThemeHeaderSelector compact />

            <div className="relative group">
              <button
                aria-label={isFocusMode ? "Notificações silenciadas (Modo Foco)" : "Notificações"}
                title={isFocusMode ? "Modo Não Perturbe: Notificações silenciadas" : "Notificações"}
                className="tap-target pressable focusable relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/8 dark:border-white/10 bg-surface/80 text-ink-soft shadow-(--elev-1) transition-all hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 active:shadow-(--elev-inset)"
              >
                {isFocusMode ? (
                  <BellOff className="h-3.5 w-3.5 text-ink-soft opacity-75" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
              </button>
              
              <div className="invisible absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-3xl bg-surface p-4 opacity-0 shadow-(--elev-3) transition-all group-hover:visible group-hover:opacity-100">
                <div className="border-b border-black/5 dark:border-white/5 pb-2 mb-2 flex items-center justify-between">
                  <span className="font-bold text-xs text-[#231F20] dark:text-[#F5F6F4]">Notificações</span>
                  {!isFocusMode && (
                    <span className="text-[11px] text-[#2F4A3C] dark:text-[#DFFFAE] font-bold cursor-pointer hover:underline">Marcar lidas</span>
                  )}
                </div>
                <div className="text-center py-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                  {isFocusMode ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-ink">
                        Modo Não Perturbe
                      </span>
                      <span className="text-[11px] text-ink-soft">Notificações e alertas sonoros/visuais silenciados no Modo Foco.</span>
                    </div>
                  ) : (
                    'Nenhuma notificação nova no momento.'
                  )}
                </div>
              </div>
            </div>

            {/* Menu do Usuário Logado: Foto, Nome e Dropdown com contexto da Empresa */}
            <div className="ml-1 flex items-center border-l border-line pl-3">
              <UserMenu
                compact
                user={user || (userName ? { name: userName, email: userEmail || '' } : null)}
                companyName={company?.tradeName || company?.legalName}
                companyCnpj={company?.cnpj}
                companyLogoUrl={company?.logoUrl}
                companyActive={!company?.closedAt}
                onSignOut={sair}
              />
            </div>
          </div>
        </header>

        {/* Top bar mobile */}
        <header className="z-30 flex h-[68px] shrink-0 items-center justify-between border-b border-line px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="rounded-xl p-2 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Menu className="h-6 w-6" />
            </button>
            <QuickActionsMenu />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink-soft shadow-(--elev-1)"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeHeaderSelector compact />
            <UserMenu
              compact
              user={user || (userName ? { name: userName, email: userEmail || '' } : null)}
              companyName={company?.tradeName || company?.legalName}
              companyCnpj={company?.cnpj}
              companyLogoUrl={company?.logoUrl}
                companyActive={!company?.closedAt}
              onSignOut={sair}
            />
          </div>
        </header>

        {avisoAdmin && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-300 lg:mx-8">
            <span>Você não tem permissão para acessar o painel administrativo.</span>
            <button onClick={() => setAvisoAdmin(false)} className="shrink-0 text-orange-500 hover:text-orange-700">✕</button>
          </div>
        )}
        <main className="w-full flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:p-8">{children}</main>
        </div>
      </div>

      {/* Atendimento rápido via WhatsApp */}
      {pathname !== '/suporte' && (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a contabilidade no WhatsApp"
          className="fixed bottom-6 right-6 z-40 flex h-13 items-center gap-2.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 font-bold text-[#DFFFAE] shadow-xl transition-all duration-200 hover:scale-105 border border-[#2F4A3C]"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline text-sm">Falar com Contador</span>
        </a>
      )}
    </div>
  );
}
