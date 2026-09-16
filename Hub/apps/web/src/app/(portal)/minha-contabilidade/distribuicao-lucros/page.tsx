import { redirect } from 'next/navigation';

/**
 * Esta tela ficou duplicada: o mesmo conteúdo já vive como aba "Distribuição
 * de Lucros" dentro de Sócios & Pró-Labore (ver ../socios/HubSocios.tsx).
 * LucroCard.tsx mudou de endereço pra lá (../socios/LucroCard.tsx); DistForm.tsx
 * (lançamento sem validação nenhuma) foi substituído pelo DistributionRequestForm
 * compartilhado (que roda as 6 travas legais do ProfitDistributionService antes
 * de gravar); actions.ts virou apps/web/src/lib/server/profit-distribution.ts,
 * compartilhado também com Patrimonial (lucro de aluguéis).
 */
export default function Page() {
  redirect('/minha-contabilidade/socios');
}
