import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { Footer } from '@/components/landing/Footer';
import { WhatsAppFab } from '@/components/landing/WhatsAppFab';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Planos & Preços Transparentes | Hexx Hub',
  description:
    'Conheça os planos do Hexx Hub: Hub Start, Hub Pro + Contabilidade ou Holding & Private. Sem taxa de cancelamento e sem surpresas.',
};

export default function PlanosPage() {
  return (
    <main className={`landing-page ${inter.variable} font-sans`}>
      <Navbar />

      {/* Hero dos Planos */}
      <section className="landing-hero" style={{ minHeight: 'auto', paddingBottom: '20px' }}>
        <div className="landing-wrap hero-inner">
          <span className="hero-eyebrow reveal in">
            Transparência Absoluta
          </span>
          <h1 className="hero-title reveal in" style={{ fontSize: '42px', maxWidth: '780px', fontWeight: 800, letterSpacing: '-0.025em' }}>
            Planos sob medida para o tamanho do seu negócio.
          </h1>
          <p className="hero-sub reveal in reveal-d1" style={{ maxWidth: '640px' }}>
            Seja para organizar suas finanças com tecnologia de ponta ou para ter uma contabilidade consultiva cuidando de tudo. Sem fidelidade contratual.
          </p>
        </div>
      </section>

      {/* Seção de Preços com Tabela Comparativa */}
      <PricingSection />

      {/* Perguntas Frequentes */}
      <FaqSection />

      <Footer />
      <WhatsAppFab />
    </main>
  );
}

