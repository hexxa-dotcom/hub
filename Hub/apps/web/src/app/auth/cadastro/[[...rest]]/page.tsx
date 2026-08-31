import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// OTP por e-mail não distingue cadastro de login — o primeiro código de um
// e-mail novo já cadastra (signInWithOtp com shouldCreateUser: true).
export default function CadastroPage() {
  redirect('/auth/login?next=/onboarding' as never);
}
