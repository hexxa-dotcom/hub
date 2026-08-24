import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { BentoGrid } from '@/components/landing/BentoGrid';
import { FeatureBlocks } from '@/components/landing/FeatureBlocks';
import { AccountingSplit } from '@/components/landing/AccountingSplit';
import { MediaSplit } from '@/components/landing/MediaSplit';
import { LeadFormSection } from '@/components/landing/LeadFormSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { Footer } from '@/components/landing/Footer';
import { WhatsAppFab } from '@/components/landing/WhatsAppFab';
import Link from 'next/link';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Recursos & Módulos do Hub | Hexx Hub',
  description:
    'Conheça em detalhes os módulos do Hexx Hub: Emissão de NFSe com 1 clique, DRE em tempo real, contratos com assinatura jurídica e gestão tributária consultiva.',
};

export default function RecursosPage() {
  return (
    <main className={`landing-page ${inter.variable} font-sans`}>
      <Navbar />

      {/* Hero dos Recursos */}
      <section className="landing-hero" style={{ minHeight: 'auto', paddingBottom: '30px' }}>
        <div className="landing-wrap hero-inner">
          <span className="hero-eyebrow reveal in">
            Visão Geral Completa da Plataforma
          </span>
          <h1 className="landing-serif hero-title reveal in" style={{ fontSize: '42px', maxWidth: '820px' }}>
            Tudo o que sua empresa precisa para operar sem atrito.
          </h1>
          <p className="hero-sub reveal in reveal-d1" style={{ maxWidth: '680px' }}>
            Explore cada um dos módulos projetados especificamente para prestadores de serviços, agências, desenvolvedores, consultores e holdings patrimoniais.
          </p>
          <div className="flex flex-wrap items-center gap-4 reveal in reveal-d2" style={{ marginTop: '24px' }}>
            <Link href="/planos" className="btn-landing btn-landing-lime">
              Ver Planos e Valores →
            </Link>
            <Link href="/simulador" className="btn-landing btn-landing-dark">
              Simular Minha Economia
            </Link>
          </div>
        </div>
      </section>

      {/* Tour Interativo pelos Módulos */}
      <ProductShowcase />

      {/* Grid de Recursos */}
      <BentoGrid />

      {/* Detalhes de Gestão e Contabilidade */}
      <AccountingSplit />
      <MediaSplit />
      <FeatureBlocks />

      {/* Formulário & Contato */}
      <LeadFormSection />

      {/* FAQ */}
      <FaqSection />

      <Footer />
      <WhatsAppFab />
    </main>
  );
}
