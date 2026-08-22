'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Buildings, Users, FileCode, Plug, Faders } from '@phosphor-icons/react';

const MENU = [
  { label: 'Geral', href: '/configuracoes', icon: Buildings },
  { label: 'Equipe e Acessos', href: '/configuracoes/equipe', icon: Users },
  { label: 'Fiscal e Tributário', href: '/configuracoes/fiscal', icon: FileCode },
  { label: 'Integrações', href: '/configuracoes/integracoes', icon: Plug },
  { label: 'Preferências', href: '/configuracoes/preferencias', icon: Faders },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-line pb-4 mb-6">
      {MENU.map((item) => {
        const isActive = 
          item.href === '/configuracoes' 
            ? pathname === '/configuracoes'
            : pathname.startsWith(item.href);
            
        return (
          <Link
            key={item.href}
            href={item.href as any}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive 
                ? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' 
                : 'text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white'
            }`}
          >
            <item.icon className={`h-4 w-4 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'opacity-70'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
