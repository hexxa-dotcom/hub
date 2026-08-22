'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import { SquaresFour, Users, FileText, CreditCard, Bell, Gear, CaretRight, List, X, SignOut, ShieldCheck, Receipt, Question, Warning, ClipboardText, PaperPlaneRight, ChartBar, Signature, Shield, Stack } from '@phosphor-icons/react';
import { ContadorSearch } from './ContadorSearch';

type NavItemDef = { label: string; href: string; icon: typeof SquaresFour; badge?: number };

/**
 * Três zonas: "Meu dia" é a rotina operacional do contador (o que abre todo
 * dia), "Negócio" é a gestão comercial da Hexxa como SaaS (planos, MRR,
 * renovação), "Sistema" é configuração/infra. Mesmo modelo de acesso de
 * antes — só a organização visual muda.
 */
function buildNavGroups(openTicketsCount: number): { label: string; items: NavItemDef[] }[] {
  return [
    {
      label: 'Meu dia',
      items: [
        { label: 'Visão geral', href: '/contador', icon: SquaresFour },
        { label: 'Clientes', href: '/contador/clientes', icon: Users },
        { label: 'Solicitações', href: '/contador/solicitacoes', icon: Question, badge: openTicketsCount || undefined },
        { label: 'Notas Fiscais', href: '/contador/notas', icon: Receipt },
        { label: 'Fechamentos', href: '/contador/fechamentos', icon: ClipboardText },
        { label: 'Contratos', href: '/contador/contratos', icon: Signature },
      ],
    },
    {
      label: 'Negócio',
      items: [
        { label: 'Planos & assinaturas', href: '/contador/planos', icon: CreditCard },
        { label: 'Renovações em risco', href: '/contador/renovacoes', icon: Warning },
        { label: 'Relatórios', href: '/contador/relatorios', icon: ChartBar },
        { label: 'Comunicações', href: '/contador/comunicacoes', icon: PaperPlaneRight },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { label: 'Usuários & acesso', href: '/contador/usuarios', icon: Shield },
        { label: 'Integrações', href: '/contador/integracoes', icon: Stack },
        { label: 'Configurações', href: '/contador/configuracoes', icon: Gear },
      ],
    },
  ];
}

function NavItem({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== '/contador' && pathname.startsWith(item.href));
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

export function ContadorShell({ children, openTicketsCount }: { children: React.ReactNode; openTicketsCount: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();

  useEffect(() => setMobileOpen(false), [pathname]);

  const navGroups = buildNavGroups(openTicketsCount);
  const iniciais = (user?.fullName || user?.primaryEmailAddress?.emailAddress || '??')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');

  function sair() {
    signOut(() => router.push('/'));
  }

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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400">Área do Contador</p>
          </div>
        )}
        {!mobile && (
          <button onClick={() => setCollapsed(c => !c)}
            className="ml-auto rounded-xl p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={collapsed ? 'Expandir' : 'Recolher'}>
            <CaretRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-xl p-1 text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pr-3">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            {(!collapsed || mobile) && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => <NavItem key={item.href} item={item} collapsed={collapsed && !mobile} />)}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`border-t border-white/10 pt-3 pr-3 space-y-1 ${collapsed && !mobile ? 'px-0' : ''}`}>
        <Link href="/dashboard" as="/dashboard"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && 'Voltar ao Portal'}
        </Link>
        <button onClick={sair} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <SignOut className="h-4 w-4 shrink-0" />
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
            <List className="h-5 w-5" />
          </button>
          <ContadorSearch />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/contador/solicitacoes"
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <Bell className="h-[18px] w-[18px]" />
              {openTicketsCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-orange-500 px-0.5 text-[9px] font-bold text-white">
                  {openTicketsCount}
                </span>
              )}
            </Link>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-xs font-semibold text-white">
              {iniciais}
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
