/**
 * O CARTÃO DE VISITA DA EMPRESA.
 *
 * A mesma peça aparece na Minha Empresa (como prévia) e no link público: fundo
 * escuro, o nome em caixa alta fina, a atividade, e embaixo o que dá
 * credibilidade — CNPJ, desde quando existe, onde fica. Com o link ligado,
 * leva o QR code para quem vê o cartão numa tela ou impresso.
 */

export interface DadosDoCartao {
  nome: string;
  atividade: string | null;
  cnpj: string;
  desde: string | null; // AAAA
  sede: string | null;
  ativa: boolean;
  logoUrl: string | null;
}

export function CartaoDaEmpresa({ dados, qrSvg, className = '' }: { dados: DadosDoCartao; qrSvg?: string | null; className?: string }) {
  const inicial = dados.nome.trim()[0]?.toUpperCase() ?? 'H';
  return (
    <div
      className={`relative isolate w-full overflow-hidden rounded-[28px] bg-[#0C110E] text-white shadow-[0_40px_80px_-30px_rgba(12,17,14,0.6)] sm:aspect-[1.72/1] ${className}`}
    >
      {/* Luz e textura: um brilho lima no canto e a trama de hexágonos da marca, quase invisível. */}
      <div className="pointer-events-none absolute -right-28 -top-32 -z-10 h-80 w-80 rounded-full bg-[#D4FF00]/[0.16] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 -z-10 h-80 w-80 rounded-full bg-[#2F4A3C]/60 blur-3xl" />
      <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="trama-hex" width="28" height="48.5" patternUnits="userSpaceOnUse" patternTransform="scale(1.1)">
            <path d="M14 0 L28 8.08 L28 24.25 L14 32.33 L0 24.25 L0 8.08 Z M14 32.33 L14 48.5" fill="none" stroke="white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#trama-hex)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />

      <div className="flex h-full flex-col justify-between gap-8 p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          {dados.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.logoUrl} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1.5" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4FF00] text-xl font-light text-[#0C110E]">{inicial}</span>
          )}
          <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
            <span className={`h-1.5 w-1.5 rounded-full ${dados.ativa ? 'bg-[#D4FF00] shadow-[0_0_10px_#D4FF00]' : 'bg-white/30'}`} />
            {dados.ativa ? 'Empresa ativa' : 'Empresa encerrada'}
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="text-[26px] font-light uppercase leading-[1.1] tracking-[0.06em] sm:text-[34px]">{dados.nome}</h2>
          {dados.atividade && <p className="mt-2.5 line-clamp-2 max-w-[46ch] text-sm leading-relaxed text-white/55">{dados.atividade}</p>}
        </div>

        <div className="flex items-end justify-between gap-6">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:gap-10">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/40">CNPJ</dt>
              <dd className="mt-1 font-mono text-[13px] tabular text-white/90">{dados.cnpj}</dd>
            </div>
            {dados.desde && (
              <div>
                <dt className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/40">Desde</dt>
                <dd className="mt-1 text-[13px] text-white/90">{dados.desde}</dd>
              </div>
            )}
            {dados.sede && (
              <div>
                <dt className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/40">Sede</dt>
                <dd className="mt-1 text-[13px] text-white/90">{dados.sede}</dd>
              </div>
            )}
          </dl>
          {qrSvg && (
            <div
              className="h-[72px] w-[72px] shrink-0 rounded-xl bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full"
              // SVG gerado aqui mesmo pela biblioteca qrcode, a partir do link da empresa.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
