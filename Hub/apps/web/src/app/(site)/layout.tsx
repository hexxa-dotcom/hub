import './site.css';
import { sora, mono } from '@/lib/site/fontes';
import { RevealRoot } from '@/components/site/Reveal';


/** Site institucional (home, planos, checkout) — identidade grafite/papel/sinal. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hx ${sora.variable} ${mono.variable}`}>
      {children}
      <RevealRoot />
    </div>
  );
}
