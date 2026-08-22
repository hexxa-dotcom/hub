'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Receipt,
  Plus,
  FileSignature,
  FileText,
  DollarSign,
  MessageCircle,
  TrendingUp,
  Scale,
  Users,
  Building2,
  Landmark,
  ShieldCheck,
  LifeBuoy,
  Settings,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NAV } from '@/lib/nav';

type CommandAction = {
  id: string;
  label: string;
  category: 'Ações Rápidas' | 'Navegação' | 'Atendimento';
  href?: string;
  icon: LucideIcon;
  action?: () => void;
  badge?: string;
};

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5599999999999';
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com minha contabilidade.')}`;

  const QUICK_ACTIONS: CommandAction[] = [
    {
      id: 'nova-nfse',
      label: 'Emitir Nova Nota Fiscal (NFSe)',
      category: 'Ações Rápidas',
      href: '/meu-negocio/notas',
      icon: Receipt,
      badge: 'Atalho 1',
    },
    {
      id: 'lancar-despesa',
      label: 'Lançar Nova Despesa / Saída',
      category: 'Ações Rápidas',
      href: '/meu-negocio/hub-financeiro',
      icon: Plus,
      badge: 'Atalho 2',
    },
    {
      id: 'novo-contrato',
      label: 'Criar Novo Contrato com Assinatura Digital',
      category: 'Ações Rápidas',
      href: '/meu-negocio/contratos',
      icon: FileSignature,
      badge: 'Atalho 3',
    },
    {
      id: 'ver-guias',
      label: 'Ver e Pagar Guias de Impostos (DAS)',
      category: 'Ações Rápidas',
      href: '/minha-contabilidade/guias',
      icon: FileText,
    },
    {
      id: 'gerar-balanco',
      label: 'Visualizar Relatório de Fechamento / Balanço',
      category: 'Ações Rápidas',
      href: '/meu-negocio/relatorios/fechamento',
      icon: FileText,
    },
    {
      id: 'falar-contador',
      label: 'Falar com o Contador no WhatsApp',
      category: 'Atendimento',
      icon: MessageCircle,
      action: () => window.open(WHATSAPP_URL, '_blank'),
      badge: 'Direto',
    },
  ];

  const NAV_ACTIONS: CommandAction[] = NAV.flatMap((sec) =>
    sec.items.map((item) => ({
      id: item.href,
      label: `${item.label} (${sec.title})`,
      category: 'Navegação' as const,
      href: item.href,
      icon:
        item.href === '/dashboard'
          ? Sparkles
          : item.href.includes('notas')
          ? Receipt
          : item.href.includes('contratos')
          ? FileSignature
          : item.href.includes('hub-financeiro')
          ? TrendingUp
          : item.href.includes('conciliacao')
          ? Scale
          : item.href.includes('clientes')
          ? Users
          : item.href.includes('patrimonial')
          ? Landmark
          : item.href.includes('cofre')
          ? ShieldCheck
          : item.href.includes('suporte')
          ? LifeBuoy
          : Settings,
    }))
  );

  const ALL_COMMANDS = [...QUICK_ACTIONS, ...NAV_ACTIONS];

  const filtered = query.trim()
    ? ALL_COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_COMMANDS;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selectedIndex, onOpenChange]);

  function executeCommand(cmd: CommandAction) {
    onOpenChange(false);
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      router.push(cmd.href as never);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-md animate-fade-up">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] shadow-2xl z-10 flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/10 px-5 py-4 bg-[#F4EFE4]/50 dark:bg-white/5">
          <Search className="h-5 w-5 shrink-0 text-[#2F4A3C] dark:text-[#DFFFAE]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="O que você deseja fazer ou acessar? (ex: emitir nota, DAS, clientes...)"
            className="w-full bg-transparent text-sm sm:text-base text-[#231F20] dark:text-[#FEFDF3] outline-none placeholder:text-[#6E6A61] dark:placeholder:text-[#A8A49C]"
          />
          <span className="hidden sm:inline-flex items-center rounded-lg bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#6E6A61] dark:text-[#A8A49C]">
            ESC
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl p-1 text-[#6E6A61] hover:bg-black/5 dark:hover:bg-white/10 sm:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6E6A61] dark:text-[#A8A49C]">
              Nenhum comando ou página encontrada para "{query}".
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'bg-[#1E3328] text-[#FEFDF3] shadow-sm'
                      : 'text-[#231F20] dark:text-[#FEFDF3] hover:bg-[#F4EFE4] dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
                        isSelected
                          ? 'bg-[#2F4A3C] text-[#DFFFAE]'
                          : 'bg-black/5 dark:bg-white/10 text-[#2F4A3C] dark:text-[#DFFFAE]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-semibold">{cmd.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? 'bg-[#DFFFAE] text-[#1E3328]'
                            : 'bg-[#EFFFD6] dark:bg-[#2F4A3C] text-[#2F4A3C] dark:text-[#DFFFAE]'
                        }`}
                      >
                        {cmd.badge}
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-medium ${
                        isSelected ? 'text-[#DFFFAE]/80' : 'text-[#6E6A61] dark:text-[#A8A49C]'
                      }`}
                    >
                      {cmd.category}
                    </span>
                    <ArrowRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        isSelected ? 'translate-x-0.5 text-[#DFFFAE]' : 'opacity-0'
                      }`}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-black/20 px-5 py-2.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navegar</span>
            <span>↵ Executar</span>
          </div>
          <span className="font-serif font-semibold">Hexxa Spotlight</span>
        </div>
      </div>
    </div>
  );
}
