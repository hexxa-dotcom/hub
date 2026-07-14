import { SignIn } from '@clerk/nextjs';

/** Login via Clerk (hash routing → sem catch-all). Esqueci a senha é tratado dentro do componente. */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center hero-blue p-4">
      <SignIn routing="hash" />
    </div>
  );
}
