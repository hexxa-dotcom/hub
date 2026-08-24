import { redirect } from 'next/navigation';

/**
 * Tela antiga de clientes (mock de fallback, botão "Ver" morto) — substituída
 * pelo CRM de verdade em /relacionamento. `addCustomerAction` deste diretório
 * ainda é usada por lá (../meu-negocio/clientes/actions), então só a página
 * foi removida da navegação, não o backend.
 */
export default function Page() {
  redirect('/relacionamento');
}
