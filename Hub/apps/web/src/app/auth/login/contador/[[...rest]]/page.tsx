import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

export default function ContadorLoginPage() {
  return (
    <Suspense>
      <AuthLayout
        type="contador"
        title="Área do Contador"
        subtitle="Acesso restrito para contadores e equipe contábil parceira"
      >
        <SignIn
          appearance={hexxaClerkAppearance}
          signUpUrl="/auth/cadastro"
          fallbackRedirectUrl="/contador"
        />
      </AuthLayout>
    </Suspense>
  );
}
