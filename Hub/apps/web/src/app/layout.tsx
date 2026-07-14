import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hexx Hub Digital',
  description: 'Portal do Cliente + Hub Operacional',
};

// Aplica o tema salvo antes da pintura (sem flash claro→escuro).
const themeScript = `(function(){try{var t=localStorage.getItem('hexxa.theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t==='system'&&m))document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ClerkProvider localization={ptBR}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}