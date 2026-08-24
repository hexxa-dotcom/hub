import type { Metadata } from 'next';
import { Source_Serif_4, Nunito_Sans } from 'next/font/google';
import '../landing.css';

import { Navbar } from '@/components/landing/Navbar';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
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
  title: 'Simulador de Autonomia & Economia | Hexx Hub',
  description:
    'Calcule quanto tempo e dinheiro sua empresa de serviços economiza integrando finanças, emissão de NFSe e contabilidade consultiva em um único lugar.',
};

export default function SimuladorPage() {
  return (
    <main className={`landing-page ${serifFont.variable} ${sansFont.variable} landing-sans`}>
      <Navbar />

      {/* Hero do Simulador */}
      <section className="landing-hero" style={{ minHeight: 'auto', paddingBottom: '40px' }}>
        <div className="landing-wrap hero-inner">
          <span className="hero-eyebrow reveal in">
            Ferramenta Interativa de Diagnóstico
          </span>
          <h1 className="landing-serif hero-title reveal in" style={{ fontSize: '42px', maxWidth: '780px' }}>
            Descubra quanto tempo e dinheiro você economiza com a Hexx.
          </h1>
          <p className="hero-sub reveal in reveal-d1" style={{ maxWidth: '640px' }}>
            Ajuste o seu faturamento mensal e sua área de atuação para ver em tempo real a redução de custos com softwares avulsos e horas salvas de burocracia contábil.
          </p>
        </div>
      </section>

      {/* Calculadora Interativa */}
      <RoiCalculator />

      {/* Depoimentos */}
      <TestimonialsSection />

      {/* Formulário de Proposta / Contato */}
      <LeadFormSection />

      {/* FAQ */}
      <FaqSection />

      <Footer />
      <WhatsAppFab />
    </main>
  );
}
