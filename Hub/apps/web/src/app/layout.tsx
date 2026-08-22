import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import type { Metadata } from 'next';
import { Source_Serif_4, Nunito_Sans } from 'next/font/google';
import './globals.css';

const serifFont = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const sansFont = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hexxdigital.com.br'),
  title: 'Hexx Hub • digital',
  description: 'Portal do Cliente e Hub Operacional de Autogestão',
};

// Aplica o tema salvo antes da pintura (sem flash claro→escuro).
const themeScript = `(function(){try{var t=localStorage.getItem('hexxa.theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t==='system'&&m))document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`min-h-screen antialiased ${serifFont.variable} ${sansFont.variable} font-sans`}>
        <ClerkProvider localization={ptBR}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}