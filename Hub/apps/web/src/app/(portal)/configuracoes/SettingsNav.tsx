'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Users, FileCode, Plug, SlidersHorizontal } from 'lucide-react';

const MENU = [
  { label: 'Geral & Empresa', href: '/configuracoes', icon: Building2 },
  { label: 'Equipe e Acessos', href: '/configuracoes/equipe', icon: Users },
  { label: 'Fiscal e Tributário', href: '/configuracoes/fiscal', icon: FileCode },
  { label: 'Integrações & ERPs', href: '/configuracoes/integracoes', icon: Plug },
  { label: 'Preferências', href: '/configuracoes/preferencias', icon: SlidersHorizontal },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex">
      <div className="inline-flex p-1.5 rounded-full border border-black/5 dark:border-white/10 bg-[#F4EFE4]/80 dark:bg-[#1A201C]/80 backdrop-blur-md gap-1 max-w-full overflow-x-auto no-scrollbar shadow-xs relative">
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
                  ? 'text-[#DFFFAE] dark:text-[#1E3328]' 
                  : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="settingsNavActivePill"
                  className="absolute inset-0 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE] shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
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


