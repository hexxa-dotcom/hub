'use client';

import { useState } from 'react';
import { Copy, Check, Share2, ExternalLink, MapPin } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: 'ghost' | 'pill' | 'icon';
}

export function CopyButton({
  text,
  label = 'Copiar',
  copiedLabel = 'Copiado!',
  className = '',
  variant = 'pill',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? copiedLabel : label}
        className={`tap-target pressable grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${className}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`tap-target pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
          : variant === 'pill'
            ? 'bg-black/5 dark:bg-white/10 text-ink-soft hover:text-ink hover:bg-black/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10'
            : 'text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

interface ShareCompanyButtonProps {
  companyData: {
    nome: string;
    razaoSocial: string;
    cnpj: string;
    regime?: string | null;
    endereco?: string | null;
    atividade?: string | null;
    cnae?: string | null;
  };
  className?: string;
}

export function ShareCompanyButton({ companyData, className = '' }: ShareCompanyButtonProps) {
  const [copied, setCopied] = useState(false);

  const textToShare = [
    `🏢 ${companyData.nome}`,
    companyData.razaoSocial !== companyData.nome ? `Razão Social: ${companyData.razaoSocial}` : null,
    `CNPJ: ${companyData.cnpj}`,
    companyData.regime ? `Regime Tributário: ${companyData.regime}` : null,
    companyData.cnae ? `CNAE: ${companyData.cnae} - ${companyData.atividade || ''}` : null,
    companyData.endereco ? `Endereço: ${companyData.endereco}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: companyData.nome,
          text: textToShare,
        });
        return;
      } catch {
        // Fallback para cópia
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`tap-target pressable inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs ${
        copied
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE] border border-[#2F4A3C]'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Ficha copiada!</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>Compartilhar Ficha</span>
        </>
      )}
    </button>
  );
}

export function OpenMapsButton({ address }: { address: string }) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="tap-target pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-all border border-black/5 dark:border-white/10"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span>Abrir no Maps</span>
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}
