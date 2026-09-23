'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  CreditCard,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Lock,
  Camera,
  Upload,
  Trash2,
  Save,
  Loader2,
  Eye,
  KeyRound,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { updateUserProfileAction } from './actions';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  avatarUrl?: string | null;
  role: string;
  isPartner?: boolean;
  companyName: string;
  partnerInfo?: {
    role: string;
    sharesPercent: number;
    proLaboreMonthly?: number | null;
  } | null;
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0] || 'U';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] || '';
  return ((first[0] || '') + (last[0] || '')).toUpperCase() || 'U';
}

function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function ProfileForm({ initialData }: { initialData: ProfileData }) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(initialData.name);
  const [phone, setPhone] = useState(initialData.phone ? formatPhone(initialData.phone) : '');
  const [cpf, setCpf] = useState(initialData.cpf ? formatDocument(initialData.cpf) : '');
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl || '');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPartner = !!initialData.isPartner || !!initialData.partnerInfo;
  const isSocioAdmin = isPartner && (initialData.role === 'ADMIN' || initialData.role === 'OWNER');
  const isSocio = isPartner && !isSocioAdmin;
  const isAdmin = !isPartner && (initialData.role === 'ADMIN' || initialData.role === 'OWNER');
  const isViewer = initialData.role === 'VIEWER';
  const hasFullAdmin = isSocioAdmin || isAdmin;

  let roleLabel = 'Visualizador (Terceiro)';
  let roleBadgeClass = 'bg-black/5 dark:bg-white/10 text-ink-soft border border-black/10 dark:border-white/10';
  let roleDescription = 'Seu acesso está configurado como Visualizador (Terceiro). Destinado a consultores, investidores externos ou auditores que necessitam apenas consultar relatórios e extratos, sem poderes para alterar cadastros ou configurações.';

  if (isSocioAdmin) {
    roleLabel = 'Sócio-Administrador';
    roleBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20';
    roleDescription = 'Você possui o papel de Sócio-Administrador desta empresa com controle executivo pleno. Tem autonomia total para alterar cadastros, emitir notas fiscais, gerenciar impostos, aprovar fechamentos contábeis, consultar lucros isentos e gerenciar os acessos de outros sócios e colaboradores.';
  } else if (isSocio) {
    roleLabel = 'Sócio';
    roleBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20';
    roleDescription = 'Você possui o papel de Sócio (cotista/investidor). Tem acesso executivo para acompanhar relatórios contábeis, balanços, DRE, fechamentos fiscais e a apuração dos seus lucros isentos distribuídos.';
  } else if (isAdmin) {
    roleLabel = 'Administrador';
    roleBadgeClass = 'bg-hexxa-green/15 text-hexxa-forest dark:text-hexxa-lime border border-hexxa-forest/20';
    roleDescription = 'Você atua como Administrador delegado da empresa. Possui poderes plenos para gerenciar as rotinas contábeis, fiscais, financeiras e cadastrais da organização.';
  } else if (initialData.role === 'FINANCE') {
    roleLabel = 'Financeiro';
    roleBadgeClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20';
    roleDescription = 'Perfil focado na gestão financeira: contas a pagar, contas a receber, conciliação bancária e emissão de notas fiscais.';
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const rawCpf = cpf ? normalizeDocument(cpf) : null;
        const rawPhone = phone ? phone.replace(/\D/g, '') : null;

        await updateUserProfileAction({
          name: name.trim(),
          phone: rawPhone,
          cpf: rawCpf,
          avatarUrl: avatarUrl || null,
        });

        setSuccessMsg('Perfil atualizado com sucesso!');
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao atualizar dados do perfil.');
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Alertas de Feedback */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-semibold text-rose-800 dark:text-rose-300"
          >
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Principal: Foto & Dados Pessoais | Poderes & Acessos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Esquerda: Foto & Dados Pessoais (7 colunas) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card: Foto de Perfil & Identidade */}
          <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-surface p-6 shadow-(--elev-1)">
            <h3 className="text-base font-bold text-ink mb-1">Foto de Perfil</h3>
            <p className="text-xs text-ink-soft mb-5">
              Esta foto aparecerá no cabeçalho do portal, no menu da sua conta e na sua identificação do Quadro de Sócios (QSA).
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Preview Avatar */}
              <div className="relative group shrink-0">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-black/10 dark:border-white/15 bg-[#1E3328] shadow-(--elev-2)">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-2xl text-[#DFFFAE]">
                      {getInitials(name)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-hexxa-forest text-[#DFFFAE] shadow-md border-2 border-surface transition-transform hover:scale-110"
                  title="Alterar foto"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* Botões de Ação da Foto */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-(--elev-1) hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Upload className="h-3.5 w-3.5 text-hexxa-forest dark:text-hexxa-lime" />
                    <span>Subir Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempUrl(avatarUrl || '');
                      setShowUrlModal(true);
                    }}
                    className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-(--elev-1) hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span>Inserir Link</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="tap-target pressable inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      title="Remover foto atual"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remover</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-ink-soft">
                  Formatos recomendados: PNG, JPG ou WebP de até 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Dados Pessoais & Cadastrais */}
          <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-surface p-6 shadow-(--elev-1) space-y-4">
            <h3 className="text-base font-bold text-ink mb-1">Dados Pessoais</h3>
            <p className="text-xs text-ink-soft mb-4">
              Informações do usuário logado na plataforma Hexx Hub.
            </p>

            <div className="space-y-4">
              {/* Nome Completo */}
              <div>
                <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                  Nome Completo
                </label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2.5 pl-10 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all"
                  />
                </div>
              </div>

              {/* E-mail (Supabase Auth - Readonly com selo) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                    E-mail de Acesso
                  </label>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Supabase Auth
                  </span>
                </div>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                  <input
                    type="email"
                    readOnly
                    value={initialData.email}
                    className="w-full rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.03] dark:bg-white/[0.04] px-4 py-2.5 pl-10 text-sm text-ink-soft cursor-not-allowed opacity-80"
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-soft">
                  O e-mail é o identificador de segurança gerenciado pelo Supabase.
                </p>
              </div>

              {/* Linha dupla: WhatsApp / Celular e CPF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                    WhatsApp / Celular
                  </label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2.5 pl-10 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-soft uppercase tracking-wide">
                    CPF
                  </label>
                  <div className="relative mt-1.5">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(formatDocument(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2.5 pl-10 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Salvar Alterações */}
            <div className="pt-4 border-t border-black/5 dark:border-white/5 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="tap-target pressable inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-md transition-all hover:bg-[#2F4A3C] disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Poderes, Permissões & Status Societário (5 colunas) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Card: Poderes & Nível de Acesso */}
          <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-surface p-6 shadow-(--elev-1) space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Poderes no Sistema</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${roleBadgeClass}`}
              >
                {hasFullAdmin ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span>{roleLabel}</span>
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              {roleDescription}
            </p>

            {/* Matriz de Poderes e Permissões */}
            <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] p-4 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Matriz de Permissões na Empresa
              </span>

              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink">Gestão Cadastral & Logo</span>
                  {hasFullAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Apenas Consulta
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink">Financeiro & Conciliação</span>
                  {hasFullAdmin || initialData.role === 'FINANCE' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Apenas Consulta
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink">Central Fiscal & Guias DAS</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink">Quadro de Sócios & Pró-labore</span>
                  {isPartner || hasFullAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Acesso Societário
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Apenas Consulta
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink">Gestão de Equipe & Convites</span>
                  {hasFullAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                      <Lock className="h-3.5 w-3.5 text-amber-500" /> Bloqueado
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/configuracoes/equipe"
                className="tap-target pressable inline-flex items-center gap-1.5 text-xs font-semibold text-hexxa-forest dark:text-hexxa-lime hover:underline"
              >
                <span>Gerenciar equipe e outros administradores</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card: Vínculo Societário (QSA) se aplicável */}
          {initialData.partnerInfo && (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 shadow-(--elev-1) space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-ink">
                  Vínculo com Contrato Social
                </h4>
              </div>

              <p className="text-xs text-ink-soft">
                Você é sócio formal registrado no Quadro de Sócios e Administradores (QSA) de <strong>{initialData.companyName}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface p-3">
                  <span className="text-[10px] uppercase font-bold text-ink-soft block">
                    Cotas Societárias
                  </span>
                  <span className="text-base font-bold text-ink font-mono">
                    {initialData.partnerInfo.sharesPercent}%
                  </span>
                </div>

                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-surface p-3">
                  <span className="text-[10px] uppercase font-bold text-ink-soft block">
                    Cargo Oficial
                  </span>
                  <span className="text-xs font-bold text-ink truncate block mt-0.5">
                    {initialData.partnerInfo.role}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/minha-empresa"
                  className="tap-target pressable inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Ver na Ficha da Empresa & QSA</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Card: Autenticação Segura Supabase */}
          <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-surface p-6 shadow-(--elev-1) space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-ink-soft" />
              <h4 className="text-sm font-bold text-ink">Autenticação & Segurança</h4>
            </div>

            <p className="text-xs text-ink-soft">
              Sua sessão está protegida pela infraestrutura de autenticação do <strong>Supabase Auth</strong> com criptografia ponta a ponta e controle estrito de locação (multitenancy).
            </p>

            <div className="flex items-center justify-between text-xs text-ink-soft pt-1 border-t border-black/5 dark:border-white/5">
              <span>Status da Conta</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ativa & Protegida</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Inserir Foto via URL */}
      <AnimatePresence>
        {showUrlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-black/10 dark:border-white/15 bg-surface p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-ink mb-2">URL da Foto de Perfil</h3>
              <p className="text-xs text-ink-soft mb-4">
                Cole o link direto da sua foto (ex.: link público do LinkedIn, Gravatar ou GitHub).
              </p>

              <input
                type="url"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://exemplo.com/minha-foto.jpg"
                className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface-card px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-hexxa-green dark:focus:ring-hexxa-lime transition-all mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="tap-target pressable rounded-full px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl(tempUrl.trim());
                    setShowUrlModal(false);
                  }}
                  className="tap-target pressable rounded-full bg-hexxa-forest px-5 py-2 text-xs font-bold text-[#DFFFAE] hover:bg-[#2F4A3C]"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </form>
  );
}
