import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
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

