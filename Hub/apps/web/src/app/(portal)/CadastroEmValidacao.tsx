import { ShieldCheck } from 'lucide-react';

/**
 * O que o cliente vê entre o cadastro e a aprovação do escritório.
 *
 * Diz o que está acontecendo e o que vem depois, sem prazo inventado. Não há
 * nada a fazer aqui — e dizer isso evita o cliente procurar um botão.
 */
export function CadastroEmValidacao({ empresa, nome }: { empresa: string; nome?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F6F4] px-4 dark:bg-[#0E1110]">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121614]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
        </div>
        <h1 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
          {nome ? `${nome.split(' ')[0]}, seu cadastro está em validação` : 'Seu cadastro está em validação'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          Recebemos os dados{empresa ? <> de <strong className="text-[#231F20] dark:text-[#F5F6F4]">{empresa}</strong></> : null}.
          Nossa equipe está conferindo as informações e configurando a parte fiscal e contábil da sua empresa,
          para garantir que tudo esteja correto desde o primeiro dia.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          Assim que terminarmos, seu acesso é liberado automaticamente. Não é preciso fazer nada por aqui.
        </p>
      </div>
    </main>
  );
}
