import { Suspense } from 'react';
import { SignUp } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export const dynamic = 'force-dynamic';

export default function CadastroPage() {
  return (
    <Suspense>
      <AuthLayout
        title="Criar sua conta"
        subtitle="Inicie a transformação financeira e contábil da sua empresa"
      >
        <SignUp
          routing="hash"
          appearance={hexxaClerkAppearance}
          signInUrl="/auth/login"
        />
      </AuthLayout>
    </Suspense>
  );
}
