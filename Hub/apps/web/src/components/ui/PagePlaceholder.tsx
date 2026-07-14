/** Placeholder de módulo — substitua pelo conteúdo real de cada tela. */
export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-2xl text-sm text-[var(--color-ink-soft)]">{description}</p>
      <div className="card-flat mt-6 rounded-[var(--radius-card)] p-10 text-center text-[var(--color-ink-soft)]">
        Em construção — estrutura pronta para implementação.
      </div>
    </div>
  );
}
