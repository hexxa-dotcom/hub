import type { Metadata } from 'next';
import { Cabecalho, Rodape, BotaoWhatsapp } from '@/components/site/Chrome';
import { Comparacao } from '@/components/site/Comparacao';

export const metadata: Metadata = {
  title: 'Planos e preços | Hexx Digital',
  description: 'Compare os planos da Hexx Digital: Sem movimento, Simples Light, Simples Completo, Presumido e MEI. Preço fixo, anual em 12× no cartão.',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ cobranca?: string }> }) {
  const { cobranca } = await searchParams;
  return (
    <>
      <Cabecalho />
      <main><Comparacao inicial={cobranca === 'mensal' ? 'mensal' : 'anual'} /></main>
      <Rodape />
      <BotaoWhatsapp />
    </>
  );
}
