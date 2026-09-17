import { redirect } from 'next/navigation';

/** A tela foi unificada em /cliente (vistas por `?v=`). Mantido para não
 *  quebrar link salvo, atalho do menu antigo e histórico do navegador. */
export default function ResumoMesPage() {
  redirect('/cliente?v=detalhes');
}
