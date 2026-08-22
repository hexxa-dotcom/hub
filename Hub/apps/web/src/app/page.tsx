import type { Metadata } from 'next';
import { Source_Serif_4, Nunito_Sans } from 'next/font/google';
import './landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
import { CarouselSection } from '@/components/landing/CarouselSection';
import { SegmentsMarquee } from '@/components/landing/SegmentsMarquee';
import { FeatureBlocks } from '@/components/landing/FeatureBlocks';
import { BigMarquee } from '@/components/landing/BigMarquee';
import { BentoGrid } from '@/components/landing/BentoGrid';
import { MediaSplit } from '@/components/landing/MediaSplit';
import { AccountingSplit } from '@/components/landing/AccountingSplit';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { CalculatorBand } from '@/components/landing/CalculatorBand';
import { SupportSection } from '@/components/landing/SupportSection';
import { FaqSection } from '@/components/landing/FaqSection';
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
  title: 'Hexx Hub • digital | Autogestão e Contabilidade Realtime para Empresas de Serviços',
  description:
    'Hexx Hub por Hexx Digital: finanças em tempo real, emissão de NFSe com 1 clique, contratos com assinatura jurídica e contabilidade consultiva.',
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
      <ProductShowcase />
      <RoiCalculator />
      <CarouselSection />
      <SegmentsMarquee />
      <FeatureBlocks />
      <BigMarquee />
      <BentoGrid />
      <MediaSplit />
      <AccountingSplit />
      <TestimonialsSection />
      <PricingSection />
      <CalculatorBand />
      <SupportSection />
      <FaqSection />
      <LeadFormSection />
      <Footer />
      <WhatsAppFab />
    </main>
  );
}
