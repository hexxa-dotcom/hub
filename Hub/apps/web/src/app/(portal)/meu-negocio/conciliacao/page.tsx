import { redirect } from 'next/navigation';

/** A conciliação agora é a aba Extrato do Financeiro. */
export default function Page() {
  redirect('/meu-negocio/hub-financeiro?aba=extrato' as never);
}
