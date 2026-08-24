'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeControls';

export function AuthLayout({
  children,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '';
  const isContador = redirectUrl.includes('/contador');

  return (
    <div className="min-h-screen w-full bg-[#FEFDF3] dark:bg-[#121614] text-[#231F20] dark:text-[#FEFDF3] flex flex-col justify-between p-4 sm:p-8 animate-fade-up">
      {/* ── Top Bar ── */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] px-4 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3] transition-all hover:scale-105"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao site
        </Link>

        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#1E3328] text-[#DFFFAE] font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
            H
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-xl font-bold tracking-tight text-[#231F20] dark:text-[#FEFDF3]">
              hexx
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest bg-[#1E3328] text-[#DFFFAE] px-1.5 py-0.5 rounded-md">
              HUB
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle collapsed />
        </div>
      </header>

      {/* ── Container Central ── */}
      <main className="my-auto w-full max-w-md mx-auto py-6 space-y-4">
        {/* Seletor de Perfil (Cliente vs Contador) */}
        <div className="flex rounded-full border border-black/10 dark:border-white/10 bg-[#F4EFE4] dark:bg-[#1A201C] p-1 text-xs shadow-sm">
          <Link
            href="/auth/login"
            className={`flex-1 text-center py-2 rounded-full font-bold transition-all ${
              !isContador
                ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
            }`}
          >
            Painel do Cliente
          </Link>
          <Link
            href="/auth/login?redirect_url=%2Fcontador"
            className={`flex-1 text-center py-2 rounded-full font-bold transition-all ${
              isContador
                ? 'bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                : 'text-[#6E6A61] dark:text-[#A8A49C] hover:text-[#231F20] dark:hover:text-[#FEFDF3]'
            }`}
          >
            Área do Contador
          </Link>
        </div>

        {/* Componente Clerk */}
        <div className="w-full flex justify-center">{children}</div>
      </main>

      {/* ── Footer Discreto ── */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-[#6E6A61] dark:text-[#A8A49C] py-4 flex items-center justify-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
        <span>Ambiente seguro certificado por SSL</span>
      </footer>
    </div>
  );
}
