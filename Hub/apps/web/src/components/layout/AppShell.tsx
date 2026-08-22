'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { SquaresFour, AddressBook, Receipt, Signature, ChartBar, Scroll, Users, Bank, LockKey, Lifebuoy, CreditCard, Gear, List, X, Bell, ChatCircle, HandCoins, Archive, FileCode, Handshake, Stack, UsersThree, ClipboardText, Scales, TrendDown, TrendUp, House, Briefcase, CurrencyDollar, FileText, Folder, Faders, Plug, CaretDown } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { NavSection } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme/ThemeControls';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { GlobalSearch } from './GlobalSearch';

const ICONS: Record<string, Icon> = {
  '/dashboard': SquaresFour,
  '/relacionamento': Handshake,
  '/meu-negocio/clientes': AddressBook,
  '/meu-negocio/notas': Scroll,
  '/meu-negocio/contratos': Signature,
  '/meu-negocio/hub-financeiro': ChartBar,
  '/meu-negocio/fiscal': FileCode,
  '/minha-contabilidade/termometro-tributario': ChartBar,
  '/meu-negocio/conciliacao': Scales,
  '/meu-negocio/contas-a-pagar': TrendDown,
  '/meu-negocio/contas-a-receber': TrendUp,
  '/configuracoes/integracoes': Plug,
  '/minha-contabilidade/guias': Receipt,
  '/minha-contabilidade/socios': UsersThree,
  '/minha-contabilidade/distribuicao-lucros': HandCoins,
  '/meu-negocio/propostas': ClipboardText,
  '/minha-contabilidade/arquivos': Archive,
  '/minha-contabilidade/departamento-pessoal': Users,
  '/patrimonial': Bank,
  '/mais/servicos': Stack,
  '/cofre': LockKey,
  '/suporte': Lifebuoy,
  '/meu-plano': CreditCard,
  '/configuracoes': Gear,
};

const GROUP_ICONS: Record<string, Icon> = {
  'Meu Negócio': House,
  'Clientes & CRM': Users,
  'Gestão Comercial': Briefcase,
  'Hub Financeiro': CurrencyDollar,
  'Minha Contabilidade': FileText,
  'Arquivos & Patrimônio': Folder,
  'Sistema': Gear,
  'Suporte e Serviços': Lifebuoy,
};

const STORAGE_KEY = 'hexxa.sidebar.collapsed';
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com minha contabilidade.')}`;

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <span className={`grid ${s} shrink-0 place-items-center rounded-[0.8rem] bg-brand-600 text-sm font-bold text-white shadow-md`}>
      H
    </span>
  );
}

function itemClass(active: boolean) {
  const base = 'flex items-center gap-3 px-4 py-3 text-sm relative transition-colors duration-200';
  if (active) {
    return `${base} font-semibold text-brand-600 dark:text-brand-300`;
  }
  return `${base} rounded-xl text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink mr-3`;
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: { label: string; href: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((i) => {
        const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
        const IconCmp = ICONS[i.href] || SquaresFour;

        return (
          <li key={i.href} className="group relative list-none">
            <Link
              href={i.href as never}
              onClick={onNavigate}
              className={itemClass(active)}
            >
              {/* O fundo ativo é renderizado quando selecionado, conectando-se ao conteúdo principal */}
              <div className={`nav-tab-bg ${active ? 'active' : ''}`} />
              <IconCmp
                weight={active ? 'fill' : 'regular'}
                className={`relative z-10 h-5 w-5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
                  active ? 'text-brand-600 dark:text-brand-300 drop-shadow-sm' : ''
                }`}
              />
              <span className="relative z-10 truncate">{i.label}</span>
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
  const [avisoAdmin, setAvisoAdmin] = useState(false);
  
  // O grupo ativo é sincronizado primariamente pela URL, mas pode ser mudado pelo clique na barra primária
  const [activeGroup, setActiveGroup] = useState<string>('Meu Negócio');

  useEffect(() => {
    if (searchParams.get('aviso') === 'sem-acesso-contador') setAvisoAdmin(true);
  }, [searchParams]);

  useEffect(() => setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  // Sincroniza o grupo ativo com a rota atual ao carregar ou mudar de página
  useEffect(() => {
    const currentSection = sections.find(s => 
      s.items.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`))
    );
    if (currentSection) {
      setActiveGroup(currentSection.title);
    }
  }, [pathname, sections]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const activeSectionData = sections.find((s) => s.title === activeGroup) || sections[0];

  const hour = new Date().getHours();
  let greeting = 'Olá, Felipe';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia, Felipe';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde, Felipe';
  else greeting = 'Boa noite, Felipe';

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Container das Sidebars Desktop (Auto-recolhe no mouse leave) */}
      <div
        className="sticky top-0 hidden h-screen shrink-0 lg:flex z-40"
        onMouseLeave={() => setCollapsed(true)}
      >
        {/* Sidebar Primária (Estreita, Fixa) — ícones flutuantes, sem fundo */}
        <aside className="h-full w-[72px] shrink-0 flex-col items-center gap-6 py-4 z-40 flex">
          <nav className="flex flex-1 flex-col gap-3 overflow-y-auto no-scrollbar w-full items-center pt-4">
            {sections.map((s) => {
              const IconCmp = GROUP_ICONS[s.title] || SquaresFour;
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
                    // Se o grupo tiver apenas 1 item (ex: Dashboard), navega direto
                    if (s.items.length === 1 && s.items[0]) {
                      router.push(s.items[0].href as never);
                    }
                  }}
                  className={`group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-300 scale-110 drop-shadow-[0_0_10px_rgba(84,132,237,0.35)]'
                      : 'text-ink-soft hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink'
                  }`}
                >
                  <IconCmp weight={isActive ? 'duotone' : 'regular'} className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar Secundária (Expansível) — mesmo vidro translúcido dos cards */}
        <aside
          className={`h-full shrink-0 flex-col card-flat !rounded-l-none transition-all duration-300 ease-out z-30 flex overflow-hidden ${
            collapsed ? 'w-0 !border-none opacity-0' : 'w-64 opacity-100'
          }`}
        >
        <div className="flex shrink-0 flex-col border-b border-line">
          {/* Workspace Switcher */}
          <div className="p-3">
            <button className="flex w-full items-center justify-between rounded-xl p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 font-bold shadow-sm border border-brand-200/50 dark:border-brand-800/50">
                  {company
                    ? (company.useTradeName && company.tradeName ? company.tradeName[0] : company.legalName[0])
                    : 'H'}
                </div>
                <div className="flex flex-col items-start overflow-hidden text-left">
                  <span className="w-full truncate text-sm font-semibold text-ink leading-tight">
                    {company
                      ? (company.useTradeName && company.tradeName ? company.tradeName : company.legalName)
                      : 'Hexx Solutions'}
                  </span>
                  <span className="w-full truncate text-[11px] font-medium text-ink-soft">
                    {company?.cnpj || 'Sem CNPJ'}
                  </span>
                </div>
              </div>
              <CaretDown weight="bold" className="h-4 w-4 shrink-0 text-ink-soft" />
            </button>
          </div>

          {/* Active Group Title */}
          <div className="px-6 pb-3 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{activeGroup}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pl-4 pr-0 pb-8 mt-4">
          <NavList items={activeSectionData?.items || []} pathname={pathname} />
        </div>
      </aside>
      </div>

      {/* Drawer mobile + backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col card-flat !rounded-l-none transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between px-6 border-b border-line">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-base font-bold text-ink">Hexx Hub</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X weight="bold" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar py-6 pl-5 pr-0 space-y-8">
          {sections.map(s => (
            <div key={s.title}>
              <h3 className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
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
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-line bg-surface/70 px-6 py-4 backdrop-blur-xl lg:flex">
          
          {/* User Greeting */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-tight text-ink">
              {greeting}
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
            />
            <GlobalSearch />
            <ThemeToggle collapsed />
            <UserButton />
            
            <div className="relative group">
              <button
                aria-label="Notificações"
                className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-card text-ink-soft transition-all hover:bg-black/5 dark:hover:bg-white/10 hover:scale-105"
              >
                <Bell weight="duotone" className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-critical shadow-[0_0_0_2px_var(--color-surface-card)]" />
              </button>
              
              <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl border border-line bg-surface-card shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-4 border-b border-line flex items-center justify-between">
                  <span className="font-semibold text-ink">Notificações</span>
                  <span className="text-xs text-brand-600 font-medium cursor-pointer hover:underline">Marcar como lidas</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-4 text-center text-sm text-ink-soft">
                    Nenhuma notificação no momento.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Top bar mobile */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-line bg-surface-card/70 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <List className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="font-bold text-ink">Hexx Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <UserButton />
            <ThemeToggle collapsed />
          </div>
        </header>

        {avisoAdmin && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-300 lg:mx-8">
            <span>Você não tem permissão para acessar o painel administrativo.</span>
            <button onClick={() => setAvisoAdmin(false)} className="shrink-0 text-orange-500 hover:text-orange-700">✕</button>
          </div>
        )}
        <main className="flex-1 p-5 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* Atendimento rápido via WhatsApp */}
      {pathname !== '/suporte' && (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a contabilidade no WhatsApp"
          className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-3 rounded-full bg-[#25D366] px-5 font-bold text-white shadow-xl transition-transform hover:scale-105 hover:shadow-2xl"
        >
          <ChatCircle weight="fill" className="h-6 w-6" />
          <span className="hidden sm:inline">Atendimento</span>
        </a>
      )}
    </div>
  );
}
