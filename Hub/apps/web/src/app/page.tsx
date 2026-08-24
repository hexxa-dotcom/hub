import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { SegmentsMarquee } from '@/components/landing/SegmentsMarquee';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { BentoGrid } from '@/components/landing/BentoGrid';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingTeaser } from '@/components/landing/PricingTeaser';
import { SupportSection } from '@/components/landing/SupportSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { LeadFormSection } from '@/components/landing/LeadFormSection';
import { Footer } from '@/components/landing/Footer';
import { WhatsAppFab } from '@/components/landing/WhatsAppFab';

const inter = Inter({
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
    <main className={`landing-page ${inter.variable} font-sans`}>
      <Navbar />
      <Hero />
      <SegmentsMarquee />
      <ProductShowcase />
      <BentoGrid />
      <TestimonialsSection />
      <PricingTeaser />
      <SupportSection />
      <FaqSection />
      <LeadFormSection />
      <Footer />
      <WhatsAppFab />
    </main>
  );
}

