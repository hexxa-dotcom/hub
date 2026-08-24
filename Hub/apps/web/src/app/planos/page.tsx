import type { Metadata } from 'next';
import { Source_Serif_4, Nunito_Sans } from 'next/font/google';
import '../landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { LeadFormSection } from '@/components/landing/LeadFormSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { Footer } from '@/components/landing/Footer';
import { WhatsAppFab } from '@/components/landing/WhatsAppFab';
import Link from 'next/link';

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
  title: 'Planos & Preços Transparentes | Hexx Hub',
  description:
    'Conheça os planos do Hexx Hub: Gestão Financeira, Contabilidade Completa Consultiva ou Holding Patrimonial. Sem taxa de cancelamento e sem surpresas.',
};

export default function PlanosPage() {
  return (
    <main className={`landing-page ${serifFont.variable} ${sansFont.variable} landing-sans`}>
      <Navbar />

      {/* Hero dos Planos */}
      <section className="landing-hero" style={{ minHeight: 'auto', paddingBottom: '20px' }}>
        <div className="landing-wrap hero-inner">
          <span className="hero-eyebrow reveal in">
            Transparência Absoluta
          </span>
          <h1 className="landing-serif hero-title reveal in" style={{ fontSize: '42px', maxWidth: '780px' }}>
            Planos sob medida para o tamanho do seu negócio.
          </h1>
          <p className="hero-sub reveal in reveal-d1" style={{ maxWidth: '640px' }}>
            Seja apenas para organizar suas finanças ou para ter uma contabilidade consultiva cuidando de todas as suas guias e declarações. Sem fidelidade contratual.
          </p>
        </div>
      </section>

      {/* Seção de Preços com Tabela Comparativa */}
      <PricingSection />

      {/* Depoimentos */}
      <TestimonialsSection />

      {/* Formulário & Dúvidas */}
      <LeadFormSection />
      <FaqSection />

      <Footer />
      <WhatsAppFab />
    </main>
  );
}
