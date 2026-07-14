'use client';

import { useState, useEffect } from 'react';
import { Save, Users, Lock, Building2, Trash2, CheckCircle2, AlertTriangle, Plus, Copy } from 'lucide-react';
import { Section, fi, lb } from '@/components/admin/AdminUI';

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
      <p className="text-xs text-slate-500">
        CNPJs desta lista podem acessar o painel <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">/admin</code>.
      </p>

      <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${
        emails.length > 0 || lista.some(c => c.noEnv && c.ativo)
          ? 'bg-green-50 dark:bg-green-900/10'
          : 'bg-yellow-50 dark:bg-yellow-900/10'
      }`}>
        <span className={`h-2 w-2 rounded-full shrink-0 ${
          emails.length > 0 || lista.some(c => c.noEnv && c.ativo) ? 'bg-green-500' : 'bg-yellow-500'
        }`} />
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {carregando
            ? 'Verificando configuração…'
            : emails.length > 0 || lista.some(c => c.noEnv && c.ativo)
            ? `Middleware ativo — acessos liberados detectados`
            : 'Nenhum acesso configurado no .env ainda'}
        </p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!carregando && lista.length === 0 && (
          <p className="py-5 text-center text-sm text-slate-400">Nenhum CNPJ na lista.</p>
        )}
        {lista.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${c.ativo ? 'bg-brand-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Building2 className={`h-4 w-4 ${c.ativo ? 'text-brand-500' : 'text-slate-400'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">{c.cnpj}</p>
              <p className="text-xs text-slate-400 truncate">{c.descricao}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                c.noEnv && c.ativo
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : !c.ativo
                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
              }`}>
                {c.noEnv && c.ativo ? '✓ No env' : !c.ativo ? 'Inativo' : '⚠ Pendente'}
              </span>
              <button type="button" onClick={() => toggleAtivo(c.id)}
                className={`relative h-5 w-9 rounded-full transition-colors ${c.ativo ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${c.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <button type="button" onClick={() => remover(c.id)}
                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {emails.map(email => (
          <div key={email} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{email}</p>
              <p className="text-xs text-slate-400">Acesso por e-mail (ADMIN_ALLOWED_EMAILS)</p>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✓ No env
            </span>
          </div>
        ))}
      </div>

      {adicionando ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-900/10 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Novo CNPJ</p>
          <div>
            <label className={lb}>CNPJ</label>
            <input value={novoCNPJ}
              onChange={e => { setNovoCNPJ(formatCNPJ(e.target.value)); setErro(''); }}
              placeholder="00.000.000/0001-00" className={`mt-1 ${fi} font-mono`} maxLength={18} />
          </div>
          <div>
            <label className={lb}>Descrição (opcional)</label>
            <input value={novaDesc} onChange={e => setNovaDesc(e.target.value)}
              placeholder="Ex: Minha contabilidade, Sócio João…" className={`mt-1 ${fi}`} />
          </div>
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={adicionar}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5" /> Adicionar
            </button>
            <button type="button" onClick={() => { setAdicionando(false); setErro(''); setNovoCNPJ(''); setNovaDesc(''); }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-brand-400 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Adicionar CNPJ
        </button>
      )}

      {temPendentes && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
              Aplicar no servidor para ativar o acesso
            </p>
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Cole o valor abaixo no <code className="font-mono bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.env.local</code> (dev) ou em <strong>Environment Variables</strong> no Vercel, depois reinicie.
          </p>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-yellow-100 dark:border-yellow-800">
              <span className="text-[10px] font-mono text-slate-500">ADMIN_ALLOWED_CNPJS</span>
              <button type="button" onClick={copiarEnv}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                <Copy className="h-3 w-3" />
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
              {envValue || '(lista vazia)'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
        <Lock className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
        <p className="text-xs text-slate-500">
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
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Usuários & Acessos</h1>
        <p className="text-sm text-slate-500">Gerenciamento de administradores e permissões de acesso ao painel</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        <Section icon={<Users className="h-4 w-4" />} title="Usuários admin" fullWidth>
          {[
            { nome: 'Filipe Heck', email: 'filipeheck7@gmail.com', nivel: 'Super Admin' },
            { nome: 'Filipe Heck', email: 'flpheck@gmail.com', nivel: 'Super Admin' },
          ].map(u => (
            <div key={u.email} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.nome}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-400">
                {u.nivel}
              </span>
            </div>
          ))}
          <button className="mt-3 text-xs text-brand-600 hover:underline dark:text-brand-400">
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

      <div className="flex justify-end">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors ${saved ? 'bg-green-500' : 'bg-brand-500 hover:bg-brand-600'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
