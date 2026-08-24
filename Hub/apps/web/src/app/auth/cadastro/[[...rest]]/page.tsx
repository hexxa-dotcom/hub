import { Suspense } from 'react';
import { SignUp } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

export default function CadastroPage() {
  return (
    <Suspense>
      <AuthLayout
        type="cliente"
        title="Criar sua Conta"
        subtitle="Inicie a transformação financeira e contábil da sua empresa"
      >
        <SignUp
          appearance={hexxaClerkAppearance}
          signInUrl="/auth/login"
          fallbackRedirectUrl="/onboarding"
        />
      </AuthLayout>
    </Suspense>
  );
}

