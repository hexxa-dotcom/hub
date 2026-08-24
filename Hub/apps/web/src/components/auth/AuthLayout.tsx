'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import '@/app/landing.css';

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

  const defaultTitle = isContador ? 'Área do Contador' : 'Acesse seu Hub';
  const defaultSubtitle = isContador
    ? 'Acesse a gestão contábil, carteira de clientes e rotinas fiscais'
    : 'Gestão financeira, fiscal e contábil em tempo real';

  return (
    // `.landing-page` (landing.css) já define background/color próprios (creme/tinta) e
    // empatam em especificidade com as classes Tailwind bg-/text- neste mesmo elemento —
    // por ordem de import, `.landing-page` costuma vencer. Força o tema escuro via style
    // inline (sempre tem prioridade) para não depender da ordem de carregamento do CSS.
    <div
      className="landing-page font-sans min-h-screen flex flex-col justify-between relative overflow-hidden"
      style={{ backgroundColor: '#121008', color: '#FEFDF3' }}
    >
      {/* Glows de Fundo da Landing Page */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full blur-3xl opacity-35"
          style={{
            background: isContador
              ? 'radial-gradient(circle, rgba(47, 74, 60, 0.7) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(96, 88, 58, 0.65) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Barra de topo dedicada ao fluxo de autenticação ──
          (não é o navbar de marketing: sem menu, dropdown "Entrar"
          nem CTA — nesta tela isso seria redundante) */}
      <header className="relative z-10 landing-wrap flex items-center justify-between py-6 sm:py-8">
        <Link href="/" className="landing-logo" style={{ color: 'var(--cream)' }}>
          <span className="logo-flex">
            <b className="logo-main">hexx</b>
            <span className="logo-tag-hub">HUB</span>
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-[#DFFFAE] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao site
        </Link>
      </header>

      {/* ── Container Central de Login ── */}
      <main className="relative z-10 my-auto py-12 sm:py-16 px-4 sm:px-6 w-full max-w-lg mx-auto flex flex-col items-center animate-fade-up">
        {/* Cabeçalho da Página */}
        <div className="text-center space-y-2 mb-8 max-w-md">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FEFDF3]">
            {title || defaultTitle}
          </h1>
          <p className="text-sm sm:text-base text-[#FEFDF3]/70 leading-relaxed">
            {subtitle || defaultSubtitle}
          </p>
        </div>

        {/* Card do Clerk */}
        <div className="w-full flex justify-center">{children}</div>

        {/* Link Alternativo Discreto */}
        <div className="mt-6 text-center">
          {isContador ? (
            <p className="text-xs text-white/50">
              É cliente da sua empresa?{' '}
              <Link href={'/auth/login' as any} className="font-bold text-[#DFFFAE] hover:underline">
                Acessar Portal do Cliente →
              </Link>
            </p>
          ) : (
            <p className="text-xs text-white/50">
              É contador parceiro da Hexx?{' '}
              <Link href={'/auth/login/contador' as any} className="font-bold text-[#DFFFAE] hover:underline">
                Acessar Área do Contador →
              </Link>
            </p>
          )}
        </div>
      </main>

      {/* ── Rodapé Minimalista Integrado ── */}
      <footer className="relative z-10 py-6 border-t border-white/10 text-center text-xs text-white/40">
        <div className="landing-wrap flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Hexx Digital. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <Link href="/#faq" className="hover:text-white/80 transition-colors">Perguntas Frequentes</Link>
            <span>·</span>
            <Link href="/#contato" className="hover:text-white/80 transition-colors">Falar com Suporte</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


