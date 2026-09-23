import { redirect } from 'next/navigation';

/** Recuperação de senha acontece dentro da tela de login. */
export default function EsqueciSenhaPage() {
  redirect('/auth/login' as any);
}
