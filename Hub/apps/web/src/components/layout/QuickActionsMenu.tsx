'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Receipt,
  FileSignature,
  FileText,
  DollarSign,
  TrendingDown,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ACTIONS = [
    {
      label: 'Emitir Nota Fiscal (NFSe)',
      sub: 'Emissão rápida com 1 clique',
      href: '/meu-negocio/notas',
      icon: Receipt,
      badge: 'Frequente',
    },
    {
      label: 'Lançar Despesa / Saída',
      sub: 'Registrar pagamento ou compra',
      href: '/meu-negocio/hub-financeiro',
      icon: TrendingDown,
    },
    {
      label: 'Novo Contrato Digital',
      sub: 'Criar minuta com assinatura jurídica',
      href: '/meu-negocio/contratos',
      icon: FileSignature,
    },
    {
      label: 'Gerar Balanço / Fechamento',
      sub: 'Relatório contábil consolidado',
      href: '/meu-negocio/relatorios/fechamento',
      icon: FileText,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-[#DFFFAE] hover:bg-[#c9f58c] text-[#1E3328] px-3.5 py-2 text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 hover:scale-105"
      >
        <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
        <span className="hidden sm:inline">Nova Ação</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] p-2 shadow-2xl z-50 animate-fade-up">
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2F4A3C] dark:text-[#DFFFAE] flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Ações Rápidas
            </span>
          </div>

          <div className="py-1 space-y-1">
            {ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-[#F4EFE4] dark:hover:bg-white/5 transition-colors group"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2F4A3C] text-[#DFFFAE] group-hover:bg-[#1E3328] group-hover:scale-105 transition-all shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate leading-tight">
                        {item.label}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] truncate">
                      {item.sub}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
