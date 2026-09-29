// Tokens da marca Hexx para Tailwind (v3: tailwind.config.ts → theme.extend | v4: converter para @theme em globals.css)
// Fontes via next/font/google: Sora (300/400/600/700) → --font-sora ; JetBrains Mono (400/500) → --font-mono

export const hexxTheme = {
  colors: {
    grafite: { DEFAULT: '#0E0E10', 2: '#1C1C20', 3: '#2A2A2E' }, // fundo principal · fundo secundário/cards escuros · borda em cards escuros
    papel: { DEFAULT: '#F3F2EE', 2: '#ECEBE6', branco: '#FFFFFF' }, // fundo claro · hover de linha de tabela · inputs claros
    sinal: { DEFAULT: '#B9E86B', hover: '#CBF08E' },               // verde-limão da marca (versão suavizada para web)
    cinza: {
      100: '#E1E0DA', // divisórias muito claras
      200: '#C9C8C2', // bordas em fundo papel
      400: '#B8B8B4', // texto secundário em fundo escuro
      500: '#8A8A86', // rótulos mono / texto terciário
      600: '#5A5A56', // rótulos em fundo claro
      700: '#3A3A38', // bordas em fundo escuro / texto corpo em fundo claro
    },
  },
  fontFamily: {
    sans: ['var(--font-sora)', 'sans-serif'],
    mono: ['var(--font-mono)', 'monospace'],
  },
  borderRadius: { none: '0' }, // a marca usa cantos retos em tudo; só avatares/pontos de status são círculos
  maxWidth: { site: '1240px', checkout: '1160px' },
  boxShadow: {
    card: '0 24px 40px -28px rgba(14,14,16,.5)',   // hover do cartão de plano
    fab: '0 14px 30px -12px rgba(0,0,0,.5)',        // botão flutuante WhatsApp
  },
  transitionTimingFunction: { hexx: 'cubic-bezier(.2,.7,.2,1)' },
};

// Escala tipográfica usada
// h1 hero:     clamp(44px, 6vw, 80px) · 600 · letter-spacing -0.055em · line-height .98
// h2 seção:    clamp(34px, 4.4vw, 56px) · 600 · -0.05em · 1.0
// h3 painel:   clamp(26px, 3vw, 36px) · 600 · -0.04em · 1.08
// h3 cartão:   22–28px · 600 · -0.03em
// corpo:       17px / 1.6 (seções) · 15px / 1.55 (cartões) · 14px (listas)
// rótulo mono: 11–12px · uppercase · letter-spacing .12–.14em
// números:     JetBrains Mono 500, letter-spacing -0.03 a -0.04em (preços 44px, saldo clamp(34px,4vw,48px))
