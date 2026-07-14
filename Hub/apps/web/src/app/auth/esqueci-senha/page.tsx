import { redirect } from 'next/navigation';

/** Recuperação de senha agora acontece dentro do fluxo de login do Clerk. */
export default function EsqueciSenhaPage() {
  redirect('/auth/login');
}
