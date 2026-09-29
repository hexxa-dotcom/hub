import { Sora, JetBrains_Mono } from 'next/font/google';
import './site.css';
import { RevealRoot } from '@/components/site/Reveal';

const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '600', '700'], variable: '--font-sora', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

/** Site institucional (home, planos, checkout) — identidade grafite/papel/sinal. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hx ${sora.variable} ${mono.variable}`}>
      {children}
      <RevealRoot />
    </div>
  );
}
