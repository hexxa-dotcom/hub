/**
 * Enquanto a tela carrega: o esqueleto no formato das páginas do sistema —
 * título com o traço, a fila de cards e as linhas da lista — em vez de uma
 * área em branco. Pulsa só a opacidade.
 */
export default function Carregando() {
  const bloco = 'rounded-full bg-black/[0.06] dark:bg-white/[0.07]';
  return (
    <div className="esqueleto mx-auto w-full space-y-16" aria-busy="true" aria-label="Carregando">
      <div className="w-fit space-y-3">
        <div className={`${bloco} h-7 w-56`} />
        <div className="h-px w-full bg-black/10 dark:bg-white/10" />
        <div className={`${bloco} h-3.5 w-72`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-36 rounded-[28px] ${i === 0 ? 'bg-black/[0.12] dark:bg-white/[0.08]' : 'bg-black/[0.05] dark:bg-white/[0.05]'}`} />
        ))}
      </div>

      <div className="space-y-4">
        <div className={`${bloco} h-3 w-32`} />
        <div className="divide-y divide-black/[0.08] overflow-hidden rounded-[28px] border border-black/5 dark:divide-white/[0.12] dark:border-white/10">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="space-y-2">
                <div className={`${bloco} h-3.5 w-48`} />
                <div className={`${bloco} h-3 w-32`} />
              </div>
              <div className={`${bloco} h-3.5 w-20`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
