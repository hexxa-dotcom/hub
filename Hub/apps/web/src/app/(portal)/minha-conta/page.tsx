import { redirect } from 'next/navigation';

export default function MinhaContaRedirectPage() {
  redirect('/perfil' as never);
}
