'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk, UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Users,
  Receipt,
  ClipboardList,
  FileSignature,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Send,
  Shield,
  Layers,
  Settings,
  ChevronRight,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  HelpCircle,
  Bell,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ContadorSearch } from './ContadorSearch';
import { ThemeToggle } from '@/components/theme/ThemeControls';

type NavItemDef = { label: string; href: string; icon: LucideIcon; badge?: number };

function buildNavGroups(openTicketsCount: number): { label: string; items: NavItemDef[] }[] {
  return [
    {
      label: 'Meu dia',
      items: [
        { label: 'Visão geral', href: '/contador', icon: LayoutDashboard },
        { label: 'Clientes', href: '/contador/clientes', icon: Users },
        { label: 'Solicitações', href: '/contador/solicitacoes', icon: HelpCircle, badge: openTicketsCount || undefined },
        { label: 'Notas Fiscais', href: '/contador/notas', icon: Receipt },
        { label: 'Fechamentos', href: '/contador/fechamentos', icon: ClipboardList },
        { label: 'Contratos', href: '/contador/contratos', icon: FileSignature },
      ],
    },
    {
      label: 'Negócio',
      items: [
        { label: 'Planos & assinaturas', href: '/contador/planos', icon: CreditCard },
        { label: 'Renovações em risco', href: '/contador/renovacoes', icon: AlertTriangle },
        { label: 'Relatórios', href: '/contador/relatorios', icon: BarChart3 },
        { label: 'Comunicações', href: '/contador/comunicacoes', icon: Send },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { label: 'Usuários & acesso', href: '/contador/usuarios', icon: Shield },
        { label: 'Integrações', href: '/contador/integracoes', icon: Layers },
        { label: 'Configurações', href: '/contador/configuracoes', icon: Settings },
      ],
    },
  ];
}

function NavItem({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== '/contador' && pathname.startsWith(item.href));
  const Icon = item.icon;
  return (
    <li className="group relative list-none">
      <Link
        href={item.href as never}
        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-[#DFFFAE] text-[#1E3328] font-bold shadow-sm'
            : 'text-[#FEFDF3]/75 hover:bg-white/10 hover:text-[#FEFDF3]'
        } ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#DFFFAE] text-[#1E3328] px-1.5 text-[10px] font-bold">
            {item.badge}
          </span>
        ) : null}
        {collapsed && item.badge ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#DFFFAE]" />
        ) : null}
      </Link>
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#1E3328] border border-[#2F4A3C] px-3 py-1.5 text-xs text-[#FEFDF3] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </li>
  );
}

export function ContadorShell({ children, openTicketsCount }: { children: React.ReactNode; openTicketsCount: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();

  useEffect(() => setMobileOpen(false), [pathname]);

  const navGroups = buildNavGroups(openTicketsCount);

  function sair() {
    signOut(() => router.push('/'));
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex h-full flex-col bg-[#1E3328] text-[#FEFDF3] border-r border-[#2F4A3C]/40 ${mobile ? 'p-4' : 'py-5 px-3'}`}>
      {/* Brand */}
      <div className={`flex items-center gap-3 pb-5 border-b border-[#2F4A3C]/40 ${collapsed && !mobile ? 'justify-center px-0' : 'px-2'}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#2F4A3C] text-[#DFFFAE] border border-[#DFFFAE]/30 text-sm font-bold shadow-sm">
          H
        </span>
        {(!collapsed || mobile) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-serif font-bold text-[#FEFDF3] leading-tight">Hexxa Hub</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#DFFFAE]">Área do Contador</p>
          </div>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto rounded-xl p-1.5 text-[#FEFDF3]/60 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expandir' : 'Recolher'}
          >
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-xl p-1.5 text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar pt-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || mobile) && (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#DFFFAE]/70">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map(item => <NavItem key={item.href} item={item} collapsed={collapsed && !mobile} />)}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`border-t border-[#2F4A3C]/40 pt-4 space-y-1.5 ${collapsed && !mobile ? 'px-0' : ''}`}>
        <Link
          href="/cliente"
          className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FEFDF3]/70 hover:bg-white/10 hover:text-[#FEFDF3] transition-colors ${collapsed && !mobile ? 'justify-center px-0' : ''}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && <span>Voltar ao Portal</span>}
        </Link>
        <button
          onClick={sair}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-[#FEFDF3]/70 hover:bg-white/10 hover:text-[#FEFDF3] transition-colors ${collapsed && !mobile ? 'justify-center px-0' : ''}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FEFDF3] dark:bg-[#121614] text-[#231F20] dark:text-[#FEFDF3]">
      {/* Sidebar desktop */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 transition-all duration-300 ease-out lg:block z-40 ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-out lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar mobile />
      </aside>

      {/* Main container */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 bg-[#FEFDF3]/85 dark:bg-[#121614]/85 px-6 lg:px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <ContadorSearch />
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <ThemeToggle collapsed />
            
            <Link
              href="/contador/solicitacoes"
              title="Solicitações abertas"
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] text-[#6E6A61] dark:text-[#A8A49C] hover:bg-[#DFFFAE] hover:text-[#231F20] transition-colors"
            >
              <Bell className="h-4 w-4" />
              {openTicketsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#e11d48] px-1 text-[9px] font-bold text-white shadow-sm">
                  {openTicketsCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2 pl-1 border-l border-black/10 dark:border-white/10">
              <UserButton />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
