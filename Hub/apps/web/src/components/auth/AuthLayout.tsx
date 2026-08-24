'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, Shield, User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeControls';

export function AuthLayout({
  children,
  type = 'cliente',
  title,
  subtitle,
}: {
  children: React.ReactNode;
  type?: 'cliente' | 'contador';
  title?: string;
  subtitle?: string;
}) {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '';
  const isContador = type === 'contador' || redirectUrl.includes('/contador');

  const activeTitle = title || (isContador ? 'Acesso do Contador' : 'Acesso à Minha Empresa');
  const activeSubtitle = subtitle || (isContador
    ? 'Painel restrito para contadores e equipe contábil'
    : 'Autogestão financeira, notas fiscais e contabilidade em tempo real');

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
        {/* Cabeçalho de Contexto Exclusivo */}
        <div className="text-center space-y-2 mb-2">
          <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-wider uppercase bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE] border border-[#2F4A3C]/20 shadow-sm">
            {isContador ? (
              <>
                <Shield className="h-3.5 w-3.5" /> Área do Contador Parceiro
              </>
            ) : (
              <>
                <User className="h-3.5 w-3.5" /> Portal do Cliente
              </>
            )}
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#231F20] dark:text-[#FEFDF3] tracking-tight">
            {activeTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] max-w-sm mx-auto">
            {activeSubtitle}
          </p>
        </div>

        {/* Componente Clerk */}
        <div className="w-full flex justify-center">{children}</div>

        {/* Link alternativo de rodapé */}
        <div className="text-center pt-2">
          {isContador ? (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              É cliente da Hexx?{' '}
              <Link href="/auth/login" className="font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline">
                Entrar no Portal do Cliente →
              </Link>
            </p>
          ) : (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              É contador parceiro?{' '}
              <Link href="/auth/login/contador" className="font-bold text-[#1E3328] dark:text-[#DFFFAE] hover:underline">
                Entrar na Área do Contador →
              </Link>
            </p>
          )}
        </div>
      </main>

      {/* ── Footer Discreto ── */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-[#6E6A61] dark:text-[#A8A49C] py-4 flex items-center justify-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-[#2F4A3C] dark:text-[#DFFFAE]" />
        <span>Ambiente seguro certificado por SSL</span>
      </footer>
    </div>
  );
}

