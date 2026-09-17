'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, Users, FileCode, Plug, SlidersHorizontal } from 'lucide-react';
import { spring, crossFade } from '@/lib/motion';

const MENU = [
  { label: 'Geral & Empresa', href: '/configuracoes', icon: Building2 },
  { label: 'Equipe e Acessos', href: '/configuracoes/equipe', icon: Users },
  { label: 'Fiscal e Tributário', href: '/configuracoes/fiscal', icon: FileCode },
  { label: 'Integrações & ERPs', href: '/configuracoes/integracoes', icon: Plug },
  { label: 'Preferências', href: '/configuracoes/preferencias', icon: SlidersHorizontal },
];

export function SettingsNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav className="mb-6 flex">
      <div className="segmented-track relative inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1 no-scrollbar">
        {MENU.map((item) => {
          const isActive = 
            item.href === '/configuracoes' 
              ? pathname === '/configuracoes'
              : pathname.startsWith(item.href);
              
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`relative z-10 inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-bold transition-colors duration-200 shrink-0 ${
                isActive 
                  ? 'text-ink'
                  : 'segmented-idle hover:text-ink'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId={reduceMotion ? undefined : 'settingsNavActivePill'}
                  className="segmented-thumb absolute inset-0 -z-10 rounded-full"
                  transition={reduceMotion ? crossFade : spring.snappy}
                />
              )}
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


