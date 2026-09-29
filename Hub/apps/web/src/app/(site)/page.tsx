import type { Metadata } from 'next';
import { Cabecalho, Rodape, BotaoWhatsapp } from '@/components/site/Chrome';
import { Home } from '@/components/site/Home';

export const metadata: Metadata = {
  title: 'Hexx Digital | Contabilidade e gestão financeira para empresas de serviço',
  description: 'Emita notas em segundos, saiba seu lucro real e tenha um contador dedicado cuidando dos seus impostos direto pelo WhatsApp.',
  openGraph: {
    title: 'Hexx Digital · Contabilidade e gestão financeira. Sem burocracia.',
    description: 'Contabilidade consultiva, finanças em tempo real e automação fiscal para empresas de serviço.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function Page() {
  return (
    <>
      <Cabecalho naHome />
      <main><Home /></main>
      <Rodape />
      <BotaoWhatsapp />
    </>
  );
}
