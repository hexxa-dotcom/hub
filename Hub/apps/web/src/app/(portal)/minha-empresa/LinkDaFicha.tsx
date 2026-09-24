'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2, Share2 } from 'lucide-react';
import { definirFichaPublicaAction } from './actions';

/**
 * O LINK DA FICHA — ligar, copiar, compartilhar, baixar o QR, desligar.
 *
 * O link nasce desligado; quando o empresário liga, ele fica no ar em
 * /e/<nome-da-empresa>. Desligar derruba o link na hora, e ligar de novo
 * devolve o mesmo endereço — quem já colou na bio não precisa trocar.
 */
export function LinkDaFicha({ url, ativa, nome, qrSvg }: { url: string | null; ativa: boolean; nome: string; qrSvg: string | null }) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (ligar: boolean) =>
    iniciar(async () => {
      setErro(null);
      try {
        await definirFichaPublicaAction(ligar);
      } catch {
        setErro('Não consegui mudar o link agora. Tente de novo.');
      }
    });

  const copiar = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  const compartilhar = async () => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: nome, url });
        return;
      } catch {
        /* cancelado: cai na cópia */
      }
    }
    await copiar();
  };

  const baixarQr = () => {
    if (!qrSvg) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([qrSvg], { type: 'image/svg+xml' }));
    a.download = `qr-${url?.split('/').pop() ?? 'ficha'}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!ativa || !url) {
    return (
      <div className="flex h-full flex-col justify-between gap-8">
        <div>
          <p className="rotulo text-ink-soft">Seu link</p>
          <p className="mt-3 text-2xl font-light leading-snug text-ink">
            Um link só para a bio do Instagram, o LinkedIn e o WhatsApp.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Quem abrir vê o cartão da empresa, os botões de contato e os dados oficiais. Nada de faturamento, CPF ou
            endereço completo — só o que já é público. Você desliga quando quiser.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => alternar(true)}
            disabled={pendente}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-6 py-3 text-sm font-bold text-hexxa-lime transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar meu link
          </button>
          {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
        </div>
      </div>
    );
  }

  const endereco = url.replace(/^https?:\/\//, '');
  return (
    <div className="flex h-full flex-col justify-between gap-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="rotulo text-ink-soft">Seu link</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> No ar
          </span>
        </div>
        <button
          type="button"
          onClick={copiar}
          title="Copiar link"
          className="group mt-4 flex w-full items-center justify-between gap-3 border-b border-black/10 pb-3 text-left dark:border-white/15"
        >
          <span className="min-w-0 truncate font-mono text-[15px] text-ink">{endereco}</span>
          {copiado ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Copy className="h-4 w-4 shrink-0 text-ink-soft group-hover:text-ink" />}
        </button>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Cole na bio do Instagram, no LinkedIn ou na assinatura do e-mail. O QR code do cartão leva para o mesmo lugar.
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={compartilhar}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime transition-opacity hover:opacity-90 dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Share2 className="h-3.5 w-3.5" /> {copiado ? 'Link copiado' : 'Compartilhar'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-ink ring-1 ring-black/10 transition-colors hover:ring-black/25 dark:ring-white/15 dark:hover:ring-white/30"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver como os outros veem
          </a>
          <button
            type="button"
            onClick={baixarQr}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-ink ring-1 ring-black/10 transition-colors hover:ring-black/25 dark:ring-white/15 dark:hover:ring-white/30"
          >
            <Download className="h-3.5 w-3.5" /> QR code
          </button>
        </div>
        <button
          type="button"
          onClick={() => alternar(false)}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft underline-offset-4 hover:text-rose-600 hover:underline disabled:opacity-60"
        >
          {pendente && <Loader2 className="h-3 w-3 animate-spin" />}
          Tirar o link do ar
        </button>
        {erro && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
      </div>
    </div>
  );
}
