/**
 * O CADASTRO, SEM DISTRAÇÃO.
 *
 * Tela inteira branca, texto preto, e uma caixa no centro com o que a pessoa
 * está fazendo agora. Nada de logo, menu ou cor: o cadastro é a primeira
 * impressão da Hexx, e o que ele precisa passar é organização. O modo escuro
 * não se aplica aqui, de propósito — a tela é sempre a mesma.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-16 sm:pt-20">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo à Hexx</h1>
          <p className="mt-2 text-sm text-black/60">
            A configuração é feita em 3 passos: sua empresa, sua nota fiscal e seu faturamento.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
