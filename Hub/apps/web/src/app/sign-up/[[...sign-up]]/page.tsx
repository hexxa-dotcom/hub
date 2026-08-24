import { Suspense } from 'react';
import { SignUp } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthLayout
        title="Criar sua conta"
        subtitle="Comece a usar o Hexx Hub em minutos"
      >
        <SignUp appearance={hexxaClerkAppearance} signInUrl="/sign-in" />
      </AuthLayout>
    </Suspense>
  );
}
