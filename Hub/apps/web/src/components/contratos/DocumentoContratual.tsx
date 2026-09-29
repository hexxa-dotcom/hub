import type { Secao } from '@/lib/contratos/textos';

/** Um documento contratual (contrato-padrão ou Termos), seção por seção. */
export function DocumentoContratual({ secoes }: { secoes: Secao[] }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-[#3A3833] dark:text-[#D6D3CC]">
      {secoes.map((s) => (
        <section key={s.titulo}>
          <h3 className="mb-1.5 font-semibold text-[#231F20] dark:text-[#F5F6F4]">{s.titulo}</h3>
          <ol className="space-y-1.5">
            {s.itens.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-[#6E6A61] dark:text-[#A8A49C]">{s.titulo.split('.')[0]}.{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
