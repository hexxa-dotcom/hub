'use client';

import { useState, useEffect } from 'react';
import { Save, Users, Lock, Building2, Trash2, CheckCircle2, AlertTriangle, Plus, Copy } from 'lucide-react';
import { Section, fi, lb } from '@/components/contador/AdminUI';

type AcessoCNPJ = {
  id: string;
  cnpj: string; 
  descricao: string;
  ativo: boolean;
  noEnv: boolean; 
};

function formatCNPJ(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function AcessoAdminCNPJ() {
  const [lista, setLista] = useState<AcessoCNPJ[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [novoCNPJ, setNovoCNPJ] = useState('');
  const [novaDesc, setNovaDesc] = useState('');
  const [erro, setErro] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch('/api/admin/access')
      .then(r => r.json())
      .then((data: { cnpjs: string[]; emails: string[] }) => {
        setEmails(data.emails);
        setLista(
          data.cnpjs.map((c, i) => ({
            id: String(i),
            cnpj: formatCNPJ(c),
            descricao: i === 0 ? 'Minha contabilidade' : 'Acesso liberado',
            ativo: true,
            noEnv: true,
          })),
        );
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  function toggleAtivo(id: string) {
    setLista(prev => prev.map(c => c.id === id ? { ...c, ativo: !c.ativo } : c));
  }

  function remover(id: string) {
    setLista(prev => prev.filter(c => c.id !== id));
  }

  function adicionar() {
    const cnpjLimpo = novoCNPJ.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { setErro('CNPJ inválido — deve ter 14 dígitos.'); return; }
    if (lista.some(c => c.cnpj.replace(/\D/g, '') === cnpjLimpo)) { setErro('Este CNPJ já está na lista.'); return; }
    setLista(prev => [...prev, {
      id: Date.now().toString(),
      cnpj: formatCNPJ(novoCNPJ),
      descricao: novaDesc || 'Sem descrição',
      ativo: true,
      noEnv: false,
    }]);
    setNovoCNPJ('');
    setNovaDesc('');
    setErro('');
    setAdicionando(false);
  }

  const envValue = lista
    .filter(c => c.ativo)
    .map(c => c.cnpj.replace(/\D/g, ''))
    .join(',');

  const temPendentes = lista.some(c => !c.noEnv);

  function copiarEnv() {
    navigator.clipboard.writeText(envValue);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        CNPJs desta lista podem acessar o painel <code className="font-mono text-[11px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-lg">/admin</code>.
      </p>

      <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 ${
        emails.length > 0 || lista.some(c => c.noEnv && c.ativo)
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'bg-amber-500/10 border border-amber-500/20'
      }`}>
        <span className={`h-2 w-2 rounded-full shrink-0 ${
          emails.length > 0 || lista.some(c => c.noEnv && c.ativo) ? 'bg-emerald-500' : 'bg-amber-500'
        }`} />
        <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">
          {carregando
            ? 'Verificando configuração…'
            : emails.length > 0 || lista.some(c => c.noEnv && c.ativo)
            ? `Middleware ativo — acessos liberados detectados`
            : 'Nenhum acesso configurado no .env ainda'}
        </p>
      </div>

      <div className="divide-y divide-black/5 dark:divide-white/10 rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-[#FEFDF3] dark:bg-[#121614]">
        {!carregando && lista.length === 0 && (
          <p className="py-5 text-center text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhum CNPJ na lista.</p>
        )}
        {lista.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-[#FEFDF3] dark:bg-[#121614]">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${c.ativo ? 'bg-[#2F4A3C]/10 text-[#2F4A3C] dark:text-[#DFFFAE]' : 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'}`}>
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-mono font-bold text-[#231F20] dark:text-[#FEFDF3]">{c.cnpj}</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] truncate">{c.descricao}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                c.noEnv && c.ativo
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : !c.ativo
                  ? 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}>
                {c.noEnv && c.ativo ? '✓ No env' : !c.ativo ? 'Inativo' : '⚠ Pendente'}
              </span>
              <button type="button" onClick={() => toggleAtivo(c.id)}
                className={`relative h-5 w-9 rounded-full transition-colors ${c.ativo ? 'bg-[#1E3328]' : 'bg-black/20 dark:bg-white/20'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${c.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <button type="button" onClick={() => remover(c.id)}
                className="text-[#6E6A61] hover:text-red-500 transition-colors p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {emails.map(email => (
          <div key={email} className="flex items-center gap-3 px-4 py-3 bg-[#FEFDF3] dark:bg-[#121614]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{email}</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Acesso por e-mail (ADMIN_ALLOWED_EMAILS)</p>
            </div>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              ✓ No env
            </span>
          </div>
        ))}
      </div>

      {adicionando ? (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4 space-y-3">
          <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3]">Novo CNPJ</p>
          <div>
            <label className={lb}>CNPJ</label>
            <input value={novoCNPJ}
              onChange={e => { setNovoCNPJ(formatCNPJ(e.target.value)); setErro(''); }}
              placeholder="00.000.000/0001-00" className={`mt-1.5 ${fi} font-mono`} maxLength={18} />
          </div>
          <div>
            <label className={lb}>Descrição (opcional)</label>
            <input value={novaDesc} onChange={e => setNovaDesc(e.target.value)}
              placeholder="Ex: Minha contabilidade, Sócio João…" className={`mt-1.5 ${fi}`} />
          </div>
          {erro && <p className="text-xs font-bold text-red-600 dark:text-red-400">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={adicionar}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-4 py-2 text-xs font-bold text-[#DFFFAE] transition-all shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Adicionar
            </button>
            <button type="button" onClick={() => { setAdicionando(false); setErro(''); setNovoCNPJ(''); setNovaDesc(''); }}
              className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#2F4A3C]/40 px-4 py-2 text-xs font-bold text-[#2F4A3C] hover:bg-[#2F4A3C]/5 dark:text-[#DFFFAE] dark:hover:bg-[#2F4A3C]/20 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Adicionar CNPJ
        </button>
      )}

      {temPendentes && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
              Aplicar no servidor para ativar o acesso
            </p>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Cole o valor abaixo no <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">.env.local</code> (dev) ou em <strong>Environment Variables</strong> no Vercel, depois reinicie.
          </p>
          <div className="rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-amber-500/20 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-amber-500/10">
              <span className="text-[10px] font-mono font-bold text-[#6E6A61] dark:text-[#A8A49C]">ADMIN_ALLOWED_CNPJS</span>
              <button type="button" onClick={copiarEnv}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
                <Copy className="h-3 w-3" />
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="px-3.5 py-2.5 font-mono text-xs text-[#231F20] dark:text-[#FEFDF3] break-all select-all">
              {envValue || '(lista vazia)'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-black/5 dark:bg-white/5 p-3.5">
        <Lock className="h-4 w-4 shrink-0 text-[#6E6A61] dark:text-[#A8A49C] mt-0.5" />
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          O middleware verifica o CNPJ ou e-mail na hora do acesso a <code className="font-mono text-[11px]">/admin</code>.
          Remova do env para revogar imediatamente.
        </p>
      </div>
    </div>
  );
}

export default function AdminUsuarios() {
  const [saved, setSaved] = useState(false);

  function salvar() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Usuários & Acessos</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Gerenciamento de administradores e permissões de acesso ao painel</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={<Users className="h-4 w-4" />} title="Usuários admin" fullWidth>
          {[
            { nome: 'Filipe Heck', email: 'filipeheck7@gmail.com', nivel: 'Super Admin' },
            { nome: 'Filipe Heck', email: 'flpheck@gmail.com', nivel: 'Super Admin' },
          ].map(u => (
            <div key={u.email} className="flex items-center justify-between py-3 border-b border-black/5 last:border-b-0 dark:border-white/10">
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{u.nome}</p>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{u.email}</p>
              </div>
              <span className="rounded-full bg-[#EFFFD6] dark:bg-[#2F4A3C] px-3 py-1 text-[10px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                {u.nivel}
              </span>
            </div>
          ))}
          <button className="mt-3 text-xs font-bold text-[#2F4A3C] hover:underline dark:text-[#DFFFAE]">
            + Adicionar administrador
          </button>
        </Section>

        <Section
          icon={<Lock className="h-4 w-4" />}
          title="Acesso admin por CNPJ"
          desc="Libere o painel /admin para CNPJs e e-mails específicos via Hub do cliente"
          fullWidth
        >
          <AcessoAdminCNPJ />
        </Section>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-white transition-all shadow-xs ${saved ? 'bg-emerald-600' : 'bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE]'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}

