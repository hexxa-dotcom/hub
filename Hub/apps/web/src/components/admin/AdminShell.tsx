'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, CreditCard, Bell,
  Settings, ChevronRight, Menu, X, Search, LogOut,
  ShieldCheck, Receipt, HelpCircle, AlertTriangle,
  ClipboardCheck, Send, BarChart2, Activity, FileSignature,
  Shield, Blocks
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Clientes', href: '/admin/clientes', icon: Users },
  { label: 'Solicitações', href: '/admin/solicitacoes', icon: HelpCircle, badge: 3 },
  { label: 'Renovações em Risco', href: '/admin/renovacoes', icon: AlertTriangle },
  { label: 'Onboarding', href: '/admin/onboarding', icon: ClipboardCheck },
  { label: 'Planos', href: '/admin/planos', icon: CreditCard },
  { label: 'Notas Fiscais', href: '/admin/notas', icon: Receipt },
  { label: 'Comunicações', href: '/admin/comunicacoes', icon: Send },
  { label: 'Relatórios', href: '/admin/relatorios', icon: BarChart2 },
  { label: 'Fechamentos', href: '/admin/fechamentos', icon: ClipboardCheck },
  { label: 'Log de Atividade', href: '/admin/logs', icon: Activity },
  { label: 'Contratos', href: '/admin/contratos', icon: FileSignature },
  { label: 'Usuários Admin', href: '/admin/usuarios', icon: Shield },
  { label: 'Integrações', href: '/admin/integracoes', icon: Blocks },
  { label: 'Configurações', href: '/admin/configuracoes', icon: Settings },
];

function NavItem({ item, collapsed }: { item: typeof NAV[0]; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
  const Icon = item.icon;
  return (
    <li className="group relative">
      <Link href={item.href as never}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-white/15 text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        } ${collapsed ? 'justify-center' : ''}`}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        ) : null}
        {collapsed && item.badge ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
        ) : null}
      </Link>
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </li>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex h-full flex-col bg-slate-900 text-white ${mobile ? 'p-3' : 'py-4 pl-3 pr-0'}`}>
      {/* Brand */}
      <div className={`flex items-center gap-2.5 px-2 pb-5 ${collapsed && !mobile ? 'justify-center' : ''}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500 text-sm font-bold">
          H
        </span>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Hexxa</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400">Admin</p>
          </div>
        )}
        {!mobile && (
          <button onClick={() => setCollapsed(c => !c)}
            className="ml-auto rounded-xl p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expandir' : 'Recolher'}>
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-xl p-1 text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-0.5 pr-3">
          {NAV.map(item => <NavItem key={item.href} item={item} collapsed={collapsed && !mobile} />)}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`border-t border-white/10 pt-3 pr-3 space-y-1 ${collapsed && !mobile ? 'px-0' : ''}`}>
        <Link href="/dashboard" as="/dashboard"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && 'Voltar ao Portal'}
        </Link>
        <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && 'Sair'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${collapsed ? 'w-[68px]' : 'w-56'}`}>
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-200 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar mobile />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
          <button onClick={() => setMobileOpen(true)} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            <Search className="h-4 w-4" />
            <input placeholder="Buscar cliente, NF, solicitação…" className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-xs font-semibold text-white">
              FH
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
