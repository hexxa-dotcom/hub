'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { ChevronDown, Menu, X, Bell, MessageCircle, Search, Pin } from 'lucide-react';
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
import { ThemeToggle } from '@/components/theme/ThemeControls';
import { LogOut } from 'lucide-react';
import { useSignOut } from '@/lib/client/useSignOut';
import { CommandMenu } from './CommandMenu';
import { QuickActionsMenu } from './QuickActionsMenu';

const GROUP_ICONS: Record<string, PhosphorIcon> = {
  'Início': SquaresFour,
  'Contabilidade': Notebook,
  'Financeiro': ArrowsDownUp,
  'Relacionamento': Handshake,
  'Gestão de Pessoas': IdentificationBadge,
  'Gestão do Patrimônio': Buildings,
  'Suporte': ChatCircleDots,
};

const STORAGE_KEY = 'hexxa.sidebar.collapsed';
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com minha contabilidade.')}`;

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`grid ${s} shrink-0 place-items-center rounded-2xl bg-[#1E3328] font-bold text-[#DFFFAE] border border-[#2F4A3C] shadow-sm`}>
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
    'flex w-full items-center gap-3 overflow-hidden rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200';
  if (active) {
    // A página em que você está fica AFUNDADA na superfície. Usa o relevo que
    // o sistema já tem, em vez de gastar cor: cor guardada rende mais quando
    // aparece uma vez só — aqui ela fica reservada para marcar a SEÇÃO.
    return `${base} font-bold text-(--sidebar-ink) shadow-(--sidebar-elev-inset)`;
  }
  if (isDarkOverlay) {
    return `${base} font-medium text-[#F5F6F4]/75 hover:bg-white/10 hover:text-[#F5F6F4]`;
  }
  // Hover afunda em vez de pintar: é a mesma gramática do resto do sistema.
  return `${base} font-medium text-(--sidebar-ink-soft) hover:text-(--sidebar-ink) hover:shadow-(--sidebar-elev-inset)`;
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
          <li key={i.href} className="group relative list-none">
            <Link
              href={i.href as never}
              onClick={onNavigate}
              className={`${itemClass(active, isDark)} ml-[30px] w-auto`}
              prefetch={false}
              title={collapsed ? i.label : undefined}
            >
              {!collapsed && <span className="truncate flex-1 text-left">{i.label}</span>}
              {!collapsed && i.badge && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isDark ? 'bg-white/10 text-[#F5F6F4]' : 'bg-black/5 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C]'
                }`}>
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

/** useSearchParams exige Suspense no prerender (Next 16). */
export function AppShell(props: {
  children: React.ReactNode;
  sections: NavSection[];
  company?: any;
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
  userName,
  userEmail,
  hasMultipleCompanies,
}: {
  children: React.ReactNode;
  sections: NavSection[];
  company?: any;
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
  const [activeGroup, setActiveGroup] = useState<string>('Financeiro');
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

  useEffect(() => setIsPinned(localStorage.getItem(STORAGE_KEY) !== '1'), []);
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

  // Título da barra de topo derivado da própria navegação: evita uma segunda
  // lista de nomes de página para manter em sincronia com o menu.
  const breadcrumb = (() => {
    for (const s of sections) {
      const item = s.items.find(
        (i) => pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`)),
      );
      if (item) return { section: s.title === item.label ? null : s.title, page: item.label };
    }
    return { section: null, page: null };
  })();

  const isCollapsed = !isPinned && !isHovered;

  // Aplicativo emoldurado: a casca escura é o "fora", e o conteúdo é um painel
  // claro arredondado flutuando dentro dela. A trilha de ícones vive sobre a
  // casca, não sobre a página — era isso que faltava para ela descolar: antes
  // tinha exatamente a mesma cor do fundo.
  //
  // No celular a moldura some (`lg:`): margem sobrando é espaço que a tela
  // pequena não tem para dar.
  return (
    <div className="flex h-screen bg-surface text-ink lg:bg-(--shell-frame)">
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Desktop Sidebar (Nibo Style - Secondary Panel Only) */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`z-40 hidden h-full shrink-0 flex-col overflow-hidden bg-(image:--sidebar-bg) text-(--sidebar-ink) transition-all duration-300 ease-in-out lg:flex ${
          isCollapsed ? 'w-[72px]' : 'w-[264px]'
        }`}
      >
        {/* Header / Brand & Company */}
        <div className="h-[68px] flex items-center justify-between px-3 shrink-0 overflow-hidden">
          <div className={`flex items-center justify-between rounded-xl p-2 shadow-(--sidebar-elev-1) transition-all ${isCollapsed ? 'w-12 justify-center' : 'w-[232px]'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-hexxa-lime text-hexxa-green-dark font-bold text-xs">
                {company
                  ? (company.useTradeName && company.tradeName ? company.tradeName[0] : company.legalName[0])
                  : 'H'}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col items-start overflow-hidden text-left w-[140px]">
                  <span className="w-full truncate text-xs font-bold leading-tight text-(--sidebar-ink)">
                    {company
                      ? (company.useTradeName && company.tradeName ? company.tradeName : company.legalName)
                      : 'Hexxa Solutions'}
                  </span>
                </div>
              )}
            </div>

            {/* PIN BUTTON */}
            {!isCollapsed && (
              <button
                onClick={() => {
                  const newVal = !isPinned;
                  setIsPinned(newVal);
                  localStorage.setItem(STORAGE_KEY, newVal ? '0' : '1');
                }}
                title={isPinned ? "Desafixar menu" : "Fixar menu"}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${
                  isPinned 
                    ? 'bg-[#1E3328] text-[#DFFFAE]' 
                    : 'text-[#6E6A61] hover:bg-black/10 dark:text-[#A8A49C] dark:hover:bg-white/10'
                }`}
              >
                <Pin className={`h-4 w-4 transition-transform ${isPinned ? '' : 'rotate-45 opacity-50'}`} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-4 pt-[120px] pb-20 w-full flex flex-col">
          {/* `w-full`, não largura fixa: 248px dentro de 232px de espaço útil
                 fazia a seleção vazar para fora da barra. */}
          <div className={`space-y-2 transition-all ${isCollapsed ? 'w-12' : 'w-full'}`}>
            {sections.map(s => {
              const isExpanded = expandedSections[s.title] ?? (s.title === activeGroup); // Default to active group
              const GroupIcon = GROUP_ICONS[s.title] ?? SquaresFour;
              const isActiveGroup = s.title === activeGroup;
              
              return (
                <div key={s.title} className="flex flex-col">
                  <button
                    onClick={() => toggleSection(s.title)}
                    title={isCollapsed ? s.title : undefined}
                    className={`tap-target pressable focusable mb-1 group flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-bold transition-all hover:shadow-(--sidebar-elev-inset) ${
                      isActiveGroup
                        ? 'text-(--sidebar-ink)'
                        : 'text-(--sidebar-ink-soft) hover:text-(--sidebar-ink)'
                    }`}
                  >
                    {/* O abacate marca só a seção em que você está. É o que
                        responde "onde estou" com o menu recolhido, quando o
                        ícone é a única coisa visível. */}
                    <GroupIcon
                      weight="duotone"
                      className={`h-6 w-6 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActiveGroup ? 'text-hexxa-lime dark:text-hexxa-green' : ''
                      }`}
                    />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left truncate uppercase tracking-wider text-[10px]">
                          {s.title}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded && !isCollapsed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="w-full relative">
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
      </aside>

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
          {sections.map(s => (
            <div key={s.title}>
              <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE]">
                {s.title}
              </h3>
              <NavList items={s.items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          ))}
        </div>
      </aside>

      {/* Painel de conteúdo: a peça clara que flutua dentro da moldura.
          É ELE que rola, não a página — por isso `overflow-hidden` aqui e
          `overflow-y-auto` no `main`. Assim os cantos arredondados cortam o
          conteúdo de verdade e a barra de topo fica fixa sem depender de
          `sticky` (que quebraria dentro de um ancestral com overflow). */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface lg:m-2 lg:rounded-[1.75rem] lg:shadow-(--panel-float)">
        {/* Top bar desktop */}
        <header className="z-30 hidden shrink-0 items-center justify-between gap-4 border-b border-line px-8 py-3.5 lg:flex">
          {/* Esquerda: onde você está. A empresa não entra aqui porque a
              sidebar já a exibe no próprio cabeçalho — repetir seria gastar a
              posição de leitura primária com informação que já está na tela.
              "Onde estou" era justamente o que faltava. */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {breadcrumb.section && (
              <>
                <span className="text-footnote text-ink-soft">{breadcrumb.section}</span>
                <span className="text-footnote text-ink-soft opacity-40">/</span>
              </>
            )}
            <h2 className="truncate text-callout font-semibold text-ink">
              {breadcrumb.page ?? 'Hexxa Hub'}
            </h2>
          </div>

          {/* Centro: Barra de Busca Centralizada com Espaço */}
          <div className="flex-1 flex justify-center max-w-md mx-auto px-4">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="group flex w-full items-center justify-between gap-2.5 rounded-full bg-surface px-4 py-2 text-footnote text-ink-soft shadow-(--elev-inset) transition-colors hover:text-ink"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 text-[#6E6A61] group-hover:text-[#231F20] dark:group-hover:text-[#F5F6F4] shrink-0" />
                <span className="truncate">Buscar comandos, clientes ou páginas...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6A61] dark:text-[#A8A49C] shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Direita, na ordem em que se usa: ação principal → o que pede
              atenção → preferência → conta. A conta fica no extremo porque é
              onde todo produto a coloca, e previsibilidade vale mais que
              originalidade em barra de topo. */}
          <div className="flex items-center gap-2 shrink-0">
            <QuickActionsMenu />

            <div className="relative group">
              <button
                aria-label="Notificações"
                className="tap-target pressable focusable relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-ink-soft shadow-(--elev-1) transition-all hover:text-ink active:shadow-(--elev-inset)"
              >
                <Bell className="h-4 w-4" />
                {/* Sem bolinha de não-lido: era fixa no código e acendia mesmo
                    com a lista vazia. Marcador que sempre acende ensina a
                    ignorar o marcador. Volta quando houver contagem real. */}
              </button>
              
              <div className="invisible absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-3xl bg-surface p-4 opacity-0 shadow-(--elev-3) transition-all group-hover:visible group-hover:opacity-100">
                <div className="border-b border-black/5 dark:border-white/5 pb-2 mb-2 flex items-center justify-between">
                  <span className="font-bold text-xs text-[#231F20] dark:text-[#F5F6F4]">Notificações</span>
                  <span className="text-[11px] text-[#2F4A3C] dark:text-[#DFFFAE] font-bold cursor-pointer hover:underline">Marcar lidas</span>
                </div>
                <div className="text-center py-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                  Nenhuma notificação nova no momento.
                </div>
              </div>
            </div>

            <ThemeToggle collapsed />

            {/* Conta: só o nome. O e-mail embaixo, a 10px, era ruído — quem
                está logado já sabe o próprio e-mail, e ele reaparece inteiro
                em Configurações. Um filete separa a conta do resto. */}
            <div className="ml-1 flex items-center gap-2 border-l border-line pl-3">
              <span className="hidden max-w-[150px] truncate text-footnote text-ink-soft xl:block">
                {userName || 'Minha conta'}
              </span>
              <button
                type="button"
                onClick={sair}
                title="Sair"
                className="tap-target pressable focusable grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
              </button>
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
            <ThemeToggle collapsed />
            <button
              type="button"
              onClick={sair}
              title="Sair"
              className="tap-target pressable focusable grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {avisoAdmin && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-300 lg:mx-8">
            <span>Você não tem permissão para acessar o painel administrativo.</span>
            <button onClick={() => setAvisoAdmin(false)} className="shrink-0 text-orange-500 hover:text-orange-700">✕</button>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:p-8">{children}</main>
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
