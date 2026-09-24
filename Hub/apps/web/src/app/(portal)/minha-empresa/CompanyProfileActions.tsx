'use client';

import { useState, useRef } from 'react';
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  MapPin,
  Camera,
  X,
  Upload,
  Globe,
  MessageSquare,
  Mail,
  Phone,
  Sparkles,
  User,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Instagram, Linkedin } from '@/components/ui/SocialIcons';
import { updateCompanyLogoAction, updatePartnerAvatarAction } from '../configuracoes/actions';

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
    website?: string | null;
    instagram?: string | null;
    whatsapp?: string | null;
  };
  className?: string;
}

export function ShareCompanyButton({ companyData, className = '' }: ShareCompanyButtonProps) {
  const [copied, setCopied] = useState(false);

  const textToShare = [
    companyData.nome.toUpperCase(),
    companyData.razaoSocial !== companyData.nome ? `Razão Social: ${companyData.razaoSocial}` : null,
    `CNPJ: ${companyData.cnpj}`,
    companyData.regime ? `Regime Tributário: ${companyData.regime}` : null,
    companyData.cnae ? `CNAE: ${companyData.cnae} - ${companyData.atividade || ''}` : null,
    companyData.website ? `Website: ${companyData.website}` : null,
    companyData.instagram ? `Instagram: ${companyData.instagram}` : null,
    companyData.whatsapp ? `WhatsApp: ${companyData.whatsapp}` : null,
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
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          : 'bg-hexxa-forest text-hexxa-lime hover:bg-hexxa-green dark:bg-hexxa-lime dark:text-hexxa-forest'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Ficha copiada</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>Compartilhar ficha</span>
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

/** Componente Interativo do Logotipo da Empresa com Modal de Troca / Upload */
export function CompanyLogoBadge({
  logoUrl,
  companyName,
}: {
  logoUrl: string | null;
  companyName: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);
  const [urlInput, setUrlInput] = useState<string>(logoUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialLetter = companyName.trim()[0]?.toUpperCase() || 'H';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewUrl(result);
      setUrlInput(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCompanyLogoAction(urlInput.trim() || null);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar logotipo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await updateCompanyLogoAction(null);
      setPreviewUrl(null);
      setUrlInput('');
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover logotipo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setModalOpen(true)}>
        {logoUrl ? (
          <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-3xl bg-white dark:bg-[#1A201C] p-2 border-2 border-black/10 dark:border-white/15 shadow-xl overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={companyName}
              className="h-full w-full object-contain rounded-2xl"
              onError={(e) => {
                // Se a URL quebrar, mostra fallback visual elegante
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E3328] to-[#2F4A3C] text-[#DFFFAE] border-2 border-[#2F4A3C] shadow-xl font-serif text-3xl sm:text-4xl font-black select-none">
            {initialLetter}
          </div>
        )}

        {/* Hover overlay para incentivar alteração/inclusão */}
        <div className="absolute inset-0 rounded-3xl sm:rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 backdrop-blur-xs">
          <Camera className="h-4 w-4" />
          <span>{logoUrl ? 'Alterar' : 'Add Logo'}</span>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-surface p-6 shadow-2xl space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
                  <Camera className="h-4 w-4" />
                </span>
                <h3 className="font-serif font-bold text-base text-ink">Logotipo da Empresa</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview da Logo */}
            <div className="flex flex-col items-center justify-center py-4 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              {previewUrl ? (
                <div className="h-28 w-28 rounded-2xl bg-white dark:bg-[#1A201C] p-2 border border-black/10 dark:border-white/15 shadow-md flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#1E3328] to-[#2F4A3C] text-[#DFFFAE] flex items-center justify-center text-3xl font-black font-serif shadow-md">
                  {initialLetter}
                </div>
              )}
              <span className="text-[11px] text-ink-soft mt-2">Pré-visualização do logotipo</span>
            </div>

            {/* Opções de Upload ou URL */}
            <div className="space-y-3">
              <div>
                <label className="rotulo text-ink-soft block mb-1.5">
                  Subir arquivo de imagem
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-4 py-2.5 text-xs font-bold text-ink transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-ink-soft" />
                  <span>Escolher arquivo do computador</span>
                </button>
              </div>

              <div>
                <label className="rotulo text-ink-soft block mb-1.5">
                  Ou colar URL da imagem
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/logo.png"
                  value={urlInput.startsWith('data:') ? '(Imagem local carregada)' : urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setPreviewUrl(e.target.value || null);
                  }}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
                />
              </div>

              {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
              {logoUrl ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remover Logo</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || !urlInput}
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest dark:bg-hexxa-lime text-[#DFFFAE] dark:text-[#141615] px-5 py-2 text-xs font-bold shadow-md hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Salvar Logotipo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Componente Interativo do Avatar do Sócio (com suporte à foto do usuário conectado) */
export function PartnerAvatarBadge({
  partnerId,
  partnerName,
  avatarUrl,
  isCurrentUser,
}: {
  partnerId: string;
  partnerName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [urlInput, setUrlInput] = useState<string>(avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = partnerName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewUrl(result);
      setUrlInput(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePartnerAvatarAction(partnerId, urlInput.trim() || null);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar foto.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await updatePartnerAvatarAction(partnerId, null);
      setPreviewUrl(null);
      setUrlInput('');
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover foto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="relative group cursor-pointer shrink-0"
        onClick={() => setModalOpen(true)}
        title={isCurrentUser ? 'Sua foto de perfil (clique para alterar)' : 'Foto do sócio'}
      >
        {avatarUrl ? (
          <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-emerald-500/40 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={partnerName} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-hexxa-forest/30 to-emerald-500/30 text-hexxa-forest dark:text-hexxa-lime font-bold text-sm border-2 border-black/5 dark:border-white/10 shadow-sm">
            {initials || 'S'}
          </div>
        )}

        {/* Hover overlay para alterar */}
        <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-xs">
          <Camera className="h-4 w-4" />
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-surface p-6 shadow-2xl space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-hexxa-forest/10 dark:bg-hexxa-lime/15 text-hexxa-forest dark:text-hexxa-lime">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-serif font-bold text-base text-ink">Foto do Perfil</h3>
                  <p className="text-xs text-ink-soft">{partnerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-ink-soft hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview do Avatar */}
            <div className="flex flex-col items-center justify-center py-4 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              {previewUrl ? (
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-emerald-500/50 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-hexxa-forest to-emerald-600 text-[#DFFFAE] flex items-center justify-center text-2xl font-bold shadow-md">
                  {initials || 'S'}
                </div>
              )}
              {isCurrentUser && (
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="h-3 w-3" /> Sua conta logada
                </span>
              )}
            </div>

            {/* Upload ou URL */}
            <div className="space-y-3">
              <div>
                <label className="rotulo text-ink-soft block mb-1.5">
                  Subir foto do dispositivo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-4 py-2.5 text-xs font-bold text-ink transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-ink-soft" />
                  <span>Escolher foto do computador</span>
                </button>
              </div>

              <div>
                <label className="rotulo text-ink-soft block mb-1.5">
                  Ou colar link direto da foto
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/minha-foto.jpg"
                  value={urlInput.startsWith('data:') ? '(Foto local carregada)' : urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setPreviewUrl(e.target.value || null);
                  }}
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2 text-xs text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime"
                />
              </div>

              {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10">
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remover Foto</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || !urlInput}
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest dark:bg-hexxa-lime text-[#DFFFAE] dark:text-[#141615] px-5 py-2 text-xs font-bold shadow-md hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Salvar Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
