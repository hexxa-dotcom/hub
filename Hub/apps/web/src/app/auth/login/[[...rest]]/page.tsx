import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { SignIn } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

// TEMPORÁRIO — ver comentário em lib/server/tenant.ts. Remover junto.
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

export default function LoginPage() {
  if (SKIP_AUTH_TEMP) redirect('/cliente');

  return (
    <Suspense>
      <AuthLayout
        type="cliente"
        title="Acesso à Minha Empresa"
        subtitle="Entre com suas credenciais para gerenciar sua empresa em tempo real"
      >
        <SignIn
          appearance={hexxaClerkAppearance}
          signUpUrl="/auth/cadastro"
          fallbackRedirectUrl="/cliente"
        />
      </AuthLayout>
    </Suspense>
  );
}

