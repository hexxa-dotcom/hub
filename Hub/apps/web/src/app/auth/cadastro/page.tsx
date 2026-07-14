import { SignUp } from '@clerk/nextjs';

/** Cadastro via Clerk (hash routing → sem catch-all). */
export default function CadastroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center hero-blue p-4">
      <SignUp routing="hash" />
    </div>
  );
}
