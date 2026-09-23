'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Building2,
  Users,
  LogOut,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

export interface CurrentUserProfile {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: 'OWNER' | 'ADMIN' | 'FINANCE' | 'STAFF' | 'ACCOUNTANT' | 'VIEWER' | string;
  isPartner?: boolean;
  phone?: string | null;
  cpf?: string | null;
  authorized?: boolean;
}

interface UserMenuProps {
  user?: CurrentUserProfile | null;
  companyName?: string;
  companyCnpj?: string;
  onSignOut?: () => void;
  compact?: boolean;
}

function formatCnpj(cnpj?: string | null): string {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0] || 'U';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] || '';
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
}

function formatRole(role?: string, isPartner?: boolean) {
  // Sócio com poderes de administração
  if (isPartner && (role === 'OWNER' || role === 'ADMIN')) {
    return {
      label: 'Sócio-Administrador',
      subtitle: 'Controle Executivo & Gestão Total',
      badge: 'Sócio-Administrador',
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      isAdmin: true,
      isPartner: true,
    };
  }

  // Sócio cotista sem administração (acesso a balanços e lucros)
  if (isPartner && role !== 'ADMIN' && role !== 'OWNER') {
    return {
      label: 'Sócio',
      subtitle: 'Acesso Societário & Consulta de Resultados',
      badge: 'Sócio',
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      isAdmin: false,
      isPartner: true,
    };
  }

  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return {
        label: 'Administrador',
        subtitle: 'Gestão e Acesso Total',
        badge: 'Administrador',
        color: 'bg-hexxa-green/15 text-hexxa-forest dark:text-hexxa-lime border-hexxa-forest/20 dark:border-hexxa-lime/20',
        isAdmin: true,
        isPartner: false,
      };
    case 'FINANCE':
      return {
        label: 'Financeiro',
        subtitle: 'Contas, Extratos e Notas',
        badge: 'Financeiro',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
        isAdmin: false,
        isPartner: false,
      };
    case 'ACCOUNTANT':
      return {
        label: 'Contador',
        subtitle: 'Acesso Fiscal & Contábil',
        badge: 'Contador',
        color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
        isAdmin: true,
        isPartner: false,
      };
    case 'STAFF':
      return {
        label: 'Colaborador',
        subtitle: 'Acesso Operacional',
        badge: 'Colaborador',
        color: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
        isAdmin: false,
        isPartner: false,
      };
    case 'VIEWER':
    default:
      return {
        label: 'Visualizador (Terceiro)',
        subtitle: 'Consulta e Relatórios (Apenas Leitura)',
        badge: 'Visualizador',
        color: 'bg-black/5 dark:bg-white/10 text-ink-soft border-black/10 dark:border-white/10',
        isAdmin: false,
        isPartner: false,
      };
  }
}

export function UserMenu({ user, companyName, companyCnpj, onSignOut, compact = false }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || 'Minha Conta';
  const roleInfo = formatRole(user?.role, user?.isPartner);
  const initials = getInitials(user?.name);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fecha no ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão Gatilho do Menu */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={displayName}
        className={`tap-target pressable group flex items-center gap-2 rounded-full transition-all ${
          compact
            ? 'p-0.5'
            : 'border border-black/8 dark:border-white/10 bg-surface/80 hover:bg-black/5 dark:hover:bg-white/5 py-1 pl-1.5 pr-2.5 shadow-(--elev-1)'
        }`}
      >
        {/* Avatar */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-black/10 dark:border-white/15 bg-[#1E3328] shadow-sm">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-xs text-[#DFFFAE]">
              {initials}
            </div>
          )}
          {/* Status Dot */}
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
        </div>

        {!compact && (
          <>
            <span className="hidden max-w-[150px] truncate text-xs font-semibold text-ink xl:block">
              {displayName}
            </span>

            <ChevronDown
              className={`h-3.5 w-3.5 text-ink-soft transition-transform duration-200 group-hover:text-ink ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right rounded-3xl border border-black/8 dark:border-white/10 bg-surface p-4 shadow-(--elev-3) backdrop-blur-2xl"
          >
            {/* Cabeçalho do Perfil */}
            <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-black/10 dark:border-white/15 bg-[#1E3328] shadow-sm">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold text-base text-[#DFFFAE]">
                    {initials}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-ink">
                  {displayName}
                </span>
                <span className="truncate text-xs text-ink-soft">
                  {user?.email || 'email@empresa.com.br'}
                </span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider ${roleInfo.color}`}
                  >
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Empresa em Acesso */}
            {(companyName || companyCnpj) && (
              <div className="my-2.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                    Empresa em Acesso
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Ativa
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-hexxa-forest/10 text-hexxa-forest dark:bg-hexxa-lime/15 dark:text-hexxa-lime">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink leading-tight">
                      {companyName || 'Empresa Conectada'}
                    </p>
                    {companyCnpj && (
                      <p className="mt-0.5 text-[11px] font-mono text-ink-soft">
                        CNPJ: {formatCnpj(companyCnpj)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ações do Menu */}
            <div className="space-y-1 py-1">
              <Link
                href={'/perfil' as never}
                prefetch={false}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
              >
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-hexxa-forest dark:text-hexxa-lime" />
                  <span>Meu Perfil</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-ink-soft group-hover:text-ink">
                  <span>Editar dados</span>
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </div>
              </Link>

              <Link
                href="/minha-empresa"
                prefetch={false}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-ink-soft group-hover:text-ink" />
                  <span>Perfil da Empresa</span>
                </div>
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>

              <Link
                href="/configuracoes/equipe"
                prefetch={false}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-ink-soft group-hover:text-ink" />
                  <span>Equipe & Permissões</span>
                </div>
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Link>
            </div>

            {/* Rodapé: Sair da Conta */}
            <div className="mt-2 border-t border-black/5 dark:border-white/5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSignOut?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair do Hexx Hub</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
