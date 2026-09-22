import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hexxdigital.com.br'),
  title: 'Hexx Hub • digital',
  description: 'Portal do Cliente e Hub Operacional de Autogestão',
};

const themeScript = `(function(){try{var t=localStorage.getItem('hexxa.theme')||'system';var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(t==='system'?(m?'dark':'light'):(t==='gray'?'focus':t));var cl=document.documentElement.classList;cl.remove('dark','theme-light','theme-focus','theme-gray');if(r==='dark'){cl.add('dark');}else if(r==='focus'){cl.add('theme-focus');}else{cl.add('theme-light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`min-h-screen antialiased ${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}