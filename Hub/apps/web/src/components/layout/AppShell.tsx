'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Handshake,
  FileText,
  FileSignature,
  TrendingUp,
  TrendingDown,
  Scale,
  Plug,
  Receipt,
  UsersRound,
  ClipboardList,
  FolderArchive,
  Users,
  Landmark,
  Layers,
  LifeBuoy,
  CreditCard,
  Settings,
  ChevronDown,
  Menu,
  X,
  Bell,
  MessageCircle,
  Briefcase,
  Wallet,
  Folder,
  Compass,
  Sparkles,
  Search,
  Sun,
  ShoppingCart,
  Calendar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavSection } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme/ThemeControls';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { CommandMenu } from './CommandMenu';
import { QuickActionsMenu } from './QuickActionsMenu';

const ICONS: Record<string, LucideIcon> = {
  '/cliente': LayoutDashboard,
  '/cliente/resumo-mes': Calendar,
  '/meu-negocio/notas': Receipt,
  '/meu-negocio/vendas': ShoppingCart,
  '/meu-negocio/contas-a-pagar': TrendingDown,
  '/meu-negocio/contas-a-receber': TrendingUp,
  '/meu-negocio/conciliacao': Scale,
  '/meu-negocio/hub-financeiro': TrendingUp,
  '/relacionamento': Handshake,
  '/meu-negocio/contratos': FileSignature,
  '/meu-negocio/propostas': ClipboardList,
  '/minha-contabilidade/guias': Receipt,
  '/minha-contabilidade/termometro-tributario': Compass,
  '/minha-contabilidade/socios': UsersRound,
  '/minha-contabilidade/departamento-pessoal': Users,
  '/meu-negocio/relatorios/fechamento': FileText,
  '/patrimonial': Landmark,
  '/minha-contabilidade/arquivos': FolderArchive,
  '/suporte': LifeBuoy,
  '/meu-plano': CreditCard,
  '/mais/servicos': Layers,
  '/configuracoes': Settings,
  '/configuracoes/integracoes': Plug,
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  'Início': LayoutDashboard,
  'Contabilidade': FileText,
  'Financeiro': Wallet,
  'Relacionamento': Handshake,
  'Gestão de Pessoas': Users,
  'Gestão do Patrimônio': Landmark,
  'Suporte': Settings,
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

function itemClass(active: boolean) {
  const base = 'flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200';
  if (active) {
    return `${base} font-bold bg-[#DFFFAE] text-[#1E3328] shadow-sm`;
  }
  return `${base} font-medium text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#231F20] dark:hover:text-[#FEFDF3]`;
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: { label: string; href: string; badge?: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((i) => {
        const active = pathname === i.href || (i.href !== '/cliente' && pathname.startsWith(`${i.href}/`));
        const IconCmp = ICONS[i.href] || LayoutDashboard;

        return (
          <li key={i.href} className="group relative list-none">
            <Link
              href={i.href as never}
              onClick={onNavigate}
              className={itemClass(active)}
            >
              <IconCmp
                className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  active ? 'text-[#1E3328]' : 'text-[#6E6A61] dark:text-[#A8A49C]'
                }`}
              />
              <span className="truncate flex-1">{i.label}</span>
              {i.badge && (
                <span className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6E6A61] dark:text-[#A8A49C]">
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
}: {
  children: React.ReactNode;
  sections: NavSection[];
  company?: any;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [avisoAdmin, setAvisoAdmin] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('Financeiro');

  useEffect(() => {
    if (searchParams.get('aviso') === 'sem-acesso-contador') setAvisoAdmin(true);
  }, [searchParams]);

  useEffect(() => setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'), []);
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

  const hour = new Date().getHours();
  let greeting = 'Olá';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  else greeting = 'Boa noite';

  return (
    <div className="flex min-h-screen bg-[#FEFDF3] dark:bg-[#121614] text-[#231F20] dark:text-[#FEFDF3]">
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Container das Sidebars Desktop */}
      <div
        className="sticky top-0 hidden h-screen shrink-0 lg:flex z-40"
        onMouseLeave={() => setCollapsed(true)}
      >
        {/* Sidebar Primária (Estreita em Verde Floresta Profundo) */}
        <aside className="h-full w-[72px] shrink-0 flex-col items-center gap-6 py-5 z-40 flex bg-[#1E3328] border-r border-[#2F4A3C]/40 text-[#FEFDF3]">
          <Link href="/cliente" className="transition-transform hover:scale-105">
            <BrandMark />
          </Link>

          <nav className="flex flex-1 flex-col gap-2.5 overflow-y-auto no-scrollbar w-full items-center pt-2">
            {sections.map((s) => {
              const IconCmp = GROUP_ICONS[s.title] || LayoutDashboard;
              const isActive = activeGroup === s.title;
              return (
                <button
                  key={s.title}
                  title={s.title}
                  onMouseEnter={() => {
                    setActiveGroup(s.title);
                    if (collapsed) setCollapsed(false);
                  }}
                  onClick={() => {
                    setActiveGroup(s.title);
                    if (collapsed) setCollapsed(false);
                    if (s.items.length === 1 && s.items[0]) {
                      router.push(s.items[0].href as never);
                    }
                  }}
                  className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#DFFFAE] text-[#1E3328] font-bold shadow-md scale-105'
                      : 'text-[#FEFDF3]/70 hover:bg-white/10 hover:text-[#FEFDF3]'
                  }`}
                >
                  <IconCmp className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar Secundária (Expansível em Warm Beige) */}
        <aside
          className={`h-full shrink-0 flex-col bg-[#F4EFE4] dark:bg-[#1A201C] border-r border-black/5 dark:border-white/10 transition-all duration-300 ease-out z-30 flex overflow-hidden ${
            collapsed ? 'w-0 !border-none opacity-0' : 'w-64 opacity-100 shadow-xl'
          }`}
        >
          <div className="flex shrink-0 flex-col border-b border-black/5 dark:border-white/10">
            {/* Workspace Switcher */}
            <div className="p-3">
              <button className="flex w-full items-center justify-between rounded-2xl p-2.5 transition-colors bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/30 border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE] font-bold text-sm shadow-sm">
                    {company
                      ? (company.useTradeName && company.tradeName ? company.tradeName[0] : company.legalName[0])
                      : 'H'}
                  </div>
                  <div className="flex flex-col items-start overflow-hidden text-left">
                    <span className="w-full truncate text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] leading-tight">
                      {company
                        ? (company.useTradeName && company.tradeName ? company.tradeName : company.legalName)
                        : 'Hexxa Solutions'}
                    </span>
                    <span className="w-full truncate text-[10px] font-medium text-[#6E6A61] dark:text-[#A8A49C]">
                      {company?.cnpj || 'Ambiente Ativo'}
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C]" />
              </button>
            </div>

            {/* Active Group Title */}
            <div className="px-5 pb-3 pt-1 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE]">{activeGroup}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
            <NavList items={activeSectionData?.items || []} pathname={pathname} />
          </div>
        </aside>
      </div>

      {/* Drawer mobile + backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#FEFDF3] dark:bg-[#1A201C] border-r border-black/10 dark:border-white/10 transition-transform duration-300 ease-out lg:hidden ${
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

      {/* Coluna de conteúdo principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar desktop */}
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-black/5 dark:border-white/10 bg-[#FEFDF3]/85 dark:bg-[#121614]/85 px-8 py-3.5 backdrop-blur-xl lg:flex">
          {/* User Greeting */}
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-serif font-semibold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              {greeting}
            </h2>
            <span className="inline-flex items-center rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-2.5 py-0.5 text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
              Conta Ativa
            </span>
          </div>

          {/* Center / Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Quick Action Button */}
            <QuickActionsMenu />

            {/* Spotlight Search Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2.5 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] shadow-sm hover:border-[#2F4A3C] dark:hover:border-[#DFFFAE] transition-all w-60 justify-between group"
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[#6E6A61] group-hover:text-[#231F20] dark:group-hover:text-[#FEFDF3]" />
                <span>Buscar comandos...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6A61] dark:text-[#A8A49C]">
                ⌘K
              </kbd>
            </button>

            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/cliente"
              afterCreateOrganizationUrl="/cliente"
            />
            <ThemeToggle collapsed />
            <UserButton />
            
            <div className="relative group">
              <button
                aria-label="Notificações"
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] transition-all hover:bg-[#DFFFAE] hover:text-[#231F20]"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e11d48]" />
              </button>
              
              <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-4">
                <div className="border-b border-black/5 dark:border-white/5 pb-2 mb-2 flex items-center justify-between">
                  <span className="font-bold text-xs text-[#231F20] dark:text-[#FEFDF3]">Notificações</span>
                  <span className="text-[11px] text-[#2F4A3C] dark:text-[#DFFFAE] font-bold cursor-pointer hover:underline">Marcar lidas</span>
                </div>
                <div className="text-center py-4 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                  Nenhuma notificação nova no momento.
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Top bar mobile */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-black/5 dark:border-white/10 bg-[#FEFDF3]/85 dark:bg-[#121614]/85 px-4 backdrop-blur-xl lg:hidden">
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
              className="grid h-9 w-9 place-items-center rounded-full bg-[#F4EFE4] dark:bg-[#1A201C] border border-black/10 text-[#6E6A61]"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle collapsed />
            <UserButton />
          </div>
        </header>

        {avisoAdmin && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-300 lg:mx-8">
            <span>Você não tem permissão para acessar o painel administrativo.</span>
            <button onClick={() => setAvisoAdmin(false)} className="shrink-0 text-orange-500 hover:text-orange-700">✕</button>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-5 lg:p-8 max-w-[1600px] w-full mx-auto overflow-x-hidden">{children}</main>
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
