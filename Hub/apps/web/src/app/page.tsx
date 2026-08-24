import type { Metadata } from 'next';
import { Source_Serif_4, Nunito_Sans } from 'next/font/google';
import './landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { CoreBenefits } from '@/components/landing/CoreBenefits';
import { PricingTeaser } from '@/components/landing/PricingTeaser';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { LeadFormSection } from '@/components/landing/LeadFormSection';
import { Footer } from '@/components/landing/Footer';
import { WhatsAppFab } from '@/components/landing/WhatsAppFab';

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
  title: 'Hexx Hub • digital | Contabilidade e Gestão Financeira para Empresas de Serviços',
  description:
    'Hexx Hub: finanças em tempo real, emissão de NFSe com 1 clique, contratos digitais e contabilidade consultiva.',
  openGraph: {
    title: 'Hexx Hub (digital) | Mais que contabilidade',
    description:
      'Gestão inteligente, contabilidade consultiva e operação simplificada para empresas de serviços e profissionais autônomos.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function HomePage() {
  return (
    <main className={`landing-page ${serifFont.variable} ${sansFont.variable} landing-sans`}>
      <Navbar />
      <Hero />
      <CoreBenefits />
      <PricingTeaser />
      <TestimonialsSection />
      <LeadFormSection />
      <Footer />
      <WhatsAppFab />
    </main>
  );
}
