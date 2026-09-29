'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { sora, mono } from '@/lib/site/fontes';

const LADO = {
  cliente: {
    titulo: 'Seu financeiro, em tempo real.',
    texto: 'Caixa, notas, contratos e impostos da sua empresa num só lugar, com seu contador a uma mensagem de distância.',
    formTitulo: 'Entrar na Hexx',
    formSub: 'Acesse o painel da sua empresa.',
    rodape: ['Ainda não é cliente?', 'Ver planos', '/planos'],
  },
  contador: {
    titulo: 'Sua carteira, organizada.',
    texto: 'Acompanhe as empresas que você atende, guias, prazos e pendências de cada cliente.',
    formTitulo: 'Área do contador',
    formSub: 'Acesse a gestão da sua carteira.',
    rodape: ['Quer atender pela Hexx?', 'Fale com a gente', '/#contato'],
  },
} as const;

/**
 * Tela de acesso (handoff do site): painel da marca à esquerda, formulário
 * à direita. Serve ao login, à verificação do código, ao código rápido e à
 * escolha de empresa — o conteúdo vem em `children`.
 */
export function AuthLayout({
  children,
  type = 'cliente',
  title,
  subtitle,
  chave = false,
}: {
  children: React.ReactNode;
  type?: 'cliente' | 'contador';
  title?: string;
  subtitle?: string;
  /** Mostra a chave "Sou cliente | Sou contador" (só na tela de e-mail). */
  chave?: boolean;
}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const contador = type === 'contador' || (sp.get('next') ?? '').startsWith('/contador') || pathname.startsWith('/auth/login/contador');
  const t = LADO[contador ? 'contador' : 'cliente'];

  return (
    <div className={`hx-auth ${sora.variable} ${mono.variable}`} style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', background: '#0E0E10', color: '#F3F2EE', fontFamily: 'var(--font-sora), sans-serif' }}>
      <div style={{ flex: '1 1 440px', position: 'relative', overflow: 'hidden', background: '#1C1C20', padding: 40, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 48, minHeight: 320 }}>
        <img src="/brand/hexx-simbolo-sinal.svg" alt="" style={{ position: 'absolute', right: -120, bottom: -120, height: 560, width: 'auto', opacity: 0.08, pointerEvents: 'none' }} />
        <Link href="/" style={{ position: 'relative', display: 'flex', alignSelf: 'flex-start' }} aria-label="Hexx Digital — início">
          <Image src="/brand/hexx-horizontal-negativo.svg" alt="hexx" width={114} height={26} priority style={{ height: 26, width: 'auto' }} />
        </Link>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 460 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px,4vw,54px)', fontWeight: 600, letterSpacing: '-.055em', lineHeight: 1, textWrap: 'balance' }}>{t.titulo}</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#B8B8B4' }}>{t.texto}</p>
        </div>
        <div style={{ position: 'relative', fontFamily: 'var(--font-mono), monospace', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A8A86' }}>Conexão segura · código por e-mail</div>
      </div>

      <div style={{ flex: '1 1 440px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {chave && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #3A3A38' }}>
              {(['cliente', 'contador'] as const).map((id) => {
                const on = (id === 'contador') === contador;
                return (
                  <Link key={id} href={(id === 'contador' ? '/auth/login/contador' : '/auth/login') as never} aria-current={on ? 'page' : undefined} style={{ padding: '13px 12px', fontSize: 14, fontWeight: 600, textAlign: 'center', background: on ? '#F3F2EE' : 'transparent', color: on ? '#0E0E10' : '#B8B8B4', transition: 'background .25s,color .25s' }}>
                    {id === 'contador' ? 'Sou contador' : 'Sou cliente'}
                  </Link>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.045em' }}>{title || t.formTitulo}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#8A8A86' }}>{subtitle || t.formSub}</p>
          </div>
          <div>{children}</div>
          {chave && (
            <div style={{ borderTop: '1px solid #1C1C20', paddingTop: 22, fontSize: 14, color: '#8A8A86' }}>
              {t.rodape[0]} <Link href={t.rodape[2] as never} style={{ color: '#F3F2EE', fontWeight: 600 }}>{t.rodape[1]}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
