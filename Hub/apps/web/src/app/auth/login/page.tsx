import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense>
      <AuthLayout
        title="Bem-vindo de volta"
        subtitle="Entre com suas credenciais para gerenciar sua empresa"
      >
        <SignIn
          routing="hash"
          appearance={hexxaClerkAppearance}
          signUpUrl="/auth/cadastro"
        />
      </AuthLayout>
    </Suspense>
  );
}
