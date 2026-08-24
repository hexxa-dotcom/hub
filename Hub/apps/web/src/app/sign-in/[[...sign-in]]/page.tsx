import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { hexxaClerkAppearance } from '@/lib/clerkTheme';

export default function SignInPage() {
  return (
    <Suspense>
      <AuthLayout
        title="Acesse sua conta"
        subtitle="Entre com suas credenciais para continuar"
      >
        <SignIn appearance={hexxaClerkAppearance} signUpUrl="/sign-up" />
      </AuthLayout>
    </Suspense>
  );
}
