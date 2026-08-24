import { redirect } from 'next/navigation';

/** "Cofre Digital" nunca chegou a ser construído e duplicava a proposta de Arquivos Permanentes. */
export default function Page() {
  redirect('/minha-contabilidade/arquivos');
}
