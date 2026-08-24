import { redirect } from 'next/navigation';

/**
 * Esta tela ficou duplicada: o mesmo conteúdo (LucroCard, DistForm, histórico)
 * já vive como aba "Distribuição de Lucros" dentro de Sócios & Pró-Labore
 * (ver ../socios/HubSocios.tsx). As actions daqui continuam em uso — só a
 * página autônoma foi removida da navegação.
 */
export default function Page() {
  redirect('/minha-contabilidade/socios');
}
